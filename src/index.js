// importing the dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const https = require('https');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const users = require('./users')
const hashs = require('./hashs')

const app = express();

// adding Helmet to enhance your API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(express.json());

// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan('combined'));

const accessTokenSecret = 'youraccesstokensecret';
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, accessTokenSecret, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};
const createJWT = ({ username, role }) => jwt.sign({ username, role }, accessTokenSecret, { expiresIn: '5h' });

//logique : generate pour avoir un token si user/password est ok, puis validate pour verifier le token et avoir un jwt


app.post("/totp-generate", async (request, response) => {
    const user = await users.find(request.body.username, request.body.password);
    if (!user)
        return response.status(403).json({ error: "Invalid Credentials" });

    response.send(await users.getTotp(user))
});

app.post("/totp-validate", async (request, response) => { 
    const user = await users.find(request.body.username, request.body.password);
    if (!user)
        return response.status(403).json({ error: "Invalid Password" });

    if (!users.checkTotp(user, request.body.token))
        return response.status(403).json({ error: "Invalid Token" });

    // Generate an access token
    response.json({ accessToken: createJWT(user) });
});

app.post('/crack', authenticateJWT, async (req, res) => {
    const error = await hashs.crack(req.body.hash, req.body.format)
    if (error)
        return res.status(200).json({ error })
    else
        return res.status(202).json({ status: 'cracking' })
});
app.post('/show', authenticateJWT, async (req, res) => {
    res.send(await hashs.show(req.body.hash, req.body.format))
})

app.post('/retour', async (req, res) => {
    const from = req.socket.remoteAddress.substr(7);
    hashs.add(from, req.body)
    res.send('Thanks')
});

app.post("/create-user", authenticateJWT, async (request, response) => {
    const { role } = request.user;
    if (await users.add(role, request.body))
        response.send("user created");
    else
        response.status(400).send("bad request");
});

Promise.all([users.init(), hashs.init()]).then(() => {
    // start the server
    const server = https.createServer({
        key: fs.readFileSync('server.key'),
        cert: fs.readFileSync('server.cert')
    }, app)
    server.listen(4443)
});
