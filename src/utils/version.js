// Basic version information
export default {
    version: '5.0.0',
    host: 'https://github.com/beiwocaishijia/gezhi-sheets',
    license: 'MIT',
    print: function () {
        return [['格知 AI', this.version, this.host, this.license].join('\r\n')];
    },
};
