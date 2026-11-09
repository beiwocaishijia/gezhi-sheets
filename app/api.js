export async function api(path, method = 'GET', body) {
    let response;
    try {
        response = await fetch('/api' + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new Error('无法连接本地服务，请确认 CE Lab 正在运行');
    }
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.error || '请求失败');
        error.code = data.code;
        error.status = response.status;
        throw error;
    }
    return data;
}
