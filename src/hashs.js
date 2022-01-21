const axios = require('axios')
const https = require('https')
const { promisify } = require('util')
const exec = promisify(require('child_process').exec)

let workers = []
const queryWorkers = () => exec('./list-nodes.sh')
    .then(({ stdout }) => {
        const ips = stdout.split('\n')
        ips.pop()
        return ips
    }).catch(() => [])
async function init() {
    const ips = await queryWorkers()
    workers = workers.filter(w => ips.includes(w.ip))
    for (const ip of ips) {
        if (!workers.some(w => w.ip == ip))
            workers.push({ ip, tasks: 0 })
    }
    setTimeout(init, 5000) // Update after 5 sec
}
function bestWorker() {
    return workers.reduce((acc, worker) => {
        if (worker.tasks < acc.tasks)
            return worker
        else
            return acc
    }, { tasks: Infinity, ip: undefined })
}

const hashs = {}
async function show(list, format) {
    return list.split('\n').reduce((acc, hash) => {
        acc[hash] = hashs[hash]
        return acc
    }, {})
}
function add(ip, tab) {
    if (!workers.find(w => w.ip == ip)) return

    for (const key in tab) {
        if (!Object.hasOwnProperty.call(tab, key)) continue
        hashs[key] = tab[key]
    }
}

// Allow self-signed
const httpsAgent = new https.Agent({ rejectUnauthorized: false })
async function crack(req_hash, format) {
    const hash = req_hash.split('\n')
        .filter(h => !(h in hashs))
        .join('\n')
    if (!hash.length) return 'Already cracked'

    const worker = bestWorker()
    if (!worker.ip) return 'No worker available'
    worker.tasks++
    axios.post('https://' + worker.ip, { hash, format }, { httpsAgent })
        .catch(console.error)
    return null
}

module.exports = { init, show, crack, add }