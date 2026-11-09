// Candidate selection only. The model still sees complete cell values, and never deletes records.
const indexes = new WeakMap();
function fingerprint(row) {
    const text = Object.values(row.values)
        .map((v) =>
            String(v ?? '')
                .normalize('NFKC')
                .toLowerCase()
                .replace(/[\s\p{P}\p{S}]/gu, '')
        )
        .join('|');
    const grams = new Set();
    // Bound comparison work, not the actual data transmitted to the provider.
    for (let i = 0; i < Math.min(text.length - 1, 256); i++) grams.add(text.slice(i, i + 2));
    return { row, text, grams };
}
function referenceCandidates(targets, allRows) {
    const ids = new Set(targets.map((r) => r.rowId));
    if (!indexes.has(allRows)) indexes.set(allRows, allRows.map(fingerprint));
    const index = indexes.get(allRows),
        sources = index.filter((r) => ids.has(r.row.rowId));
    const ranked = index
        .filter((r) => !ids.has(r.row.rowId))
        .map((candidate) => {
            let score = 0;
            for (const source of sources) {
                if (candidate.text && candidate.text === source.text) {
                    score = 1;
                    break;
                }
                let common = 0;
                for (const gram of source.grams) if (candidate.grams.has(gram)) common++;
                score = Math.max(score, common / Math.max(1, source.grams.size + candidate.grams.size - common));
            }
            return { ...candidate, score };
        })
        .filter((r) => r.score >= 0.45)
        .sort((a, b) => b.score - a.score);
    const references = [];
    let size = JSON.stringify(targets).length;
    for (const candidate of ranked) {
        const length = JSON.stringify(candidate.row).length;
        if (targets.length + references.length >= 20) break;
        if (size + length <= 40000) {
            references.push(candidate.row);
            size += length;
        }
    }
    return references;
}
module.exports = { referenceCandidates };
