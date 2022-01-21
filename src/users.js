const Speakeasy = require("speakeasy");
const bcrypt = require("bcrypt");
const QRCode = require('qrcode');

const users = {}

async function init() {
    const secret = Speakeasy.generateSecret({ length: 20 });
    users['admin'] = { password: '$2b$10$qkVMPfCRzXc7TH293VMhf.bgodtvOEkrrm/dFrwfFckoQdaDfWi5a', role: 'admin', secret }
} 

async function find(username, password) {
    if (!(username in users)) return null
    const user = users[username]
    if (!(await bcrypt.compare(password, user.password))) return null
    return user 
}
async function add(role, request) {
    if (!(
        (request.role == "user" && (role == "admin" || role == "creator")) ||
        (request.role == "creator" && role == "admin")
    )) return false
    if (request.username in users) return false

    const salt = await bcrypt.genSalt(10);
    // now we set user password to hashed password
    const password = await bcrypt.hash(request.password, salt);
    const secret = Speakeasy.generateSecret({ length: 20 });
    users[request.username] = { password, role: request.role, secret }
    return true
}

function getTotp(user) {
    return require('util').promisify(QRCode.toDataURL)(user.secret.otpauth_url, { type: 'terminal' })
        .then(url => ({ url }))
}
function checkTotp(user, token) {
    return Speakeasy.totp.verify({
        secret: user.secret.base32,
        encoding: "base32",
        token,
        window: 0
    })
}

module.exports = { init, find, add, getTotp, checkTotp };