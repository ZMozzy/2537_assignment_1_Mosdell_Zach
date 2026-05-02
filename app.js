require('dotenv').config();
const path = require('path');

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_user_database = process.env.MONGODB_USER_DATABASE;
const mongodb_session_database = process.env.MONGODB_SESSION_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const mongoSanitizer = require('mongo-sanitizer').default;
const app = express();

const port = process.env.PORT || 3000;


const {database} = require('./dbconnect');
let userCollection = database.db(mongodb_user_database).collection('users');

var mongoStore = (MongoStore.create || MongoStore.default.create)({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_session_database}`,
	crypto: {
		secret: mongodb_session_secret
	}
});

app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }//1hr
}));

app.use(express.urlencoded({ extended: false }));

app.use(mongoSanitizer(
    {replaceWith: '_'}
));

// Initialize database connection and start server
database.on('connect', () => {
	console.log('App initialized with database');
});

app.get('/', (req, res) => {
    if (!req.session.authenticated) {
        res.send(`<a href="/login"><button>Login</button></a>
                <a href="/register"><button>Register</button></a>`);
    } else {
        res.send(`<h1>Welcome, ${req.session.username}!</h1>
                <a href="/members"><button>Members Area</button></a>
                <a href="/logout"><button>Logout</button></a>`);
    }
});

app.get('/login', (req, res) => {
    res.send(`<form method="POST" action="/loggingIn">
                <input type="email" name="email" placeholder="Email" required>
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit">Login</button>
              </form>`);
});

//look
app.post('/loggingIn', async (req, res) => {
    const { email, password } = req.body;
    const user = await userCollection.findOne({ email: email });
    if (!user) {
        return res.status(401).send(`<p>Invalid email or password</p><a href="/login"><button>Try Again</button></a>`);
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).send(`<p>Invalid email or password</p><a href="/login"><button>Try Again</button></a>`);
    }
    req.session.authenticated = true;
    req.session.username = user.username;

    req.session.save(() => {
        res.redirect('/');
    });
});

app.get('/register', (req, res) => {
    res.send(`<form method="POST" action="/registering">
                <input type="text" name="username" placeholder="Username" required>
                <input type="email" name="email" placeholder="Email" required>
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit">Register</button>
              </form>`);
});

//look
app.post('/registering', async (req, res) => {
    const { username, email, password } = req.body;
    const existingUser = await userCollection.findOne({ email: email });
    if (existingUser) {
        return res.status(400).send(`<p>Email already exists</p><a href="/register"><button>Try Again</button></a>`);
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    await userCollection.insertOne({ username: username, email: email, password: hashedPassword });
    
    req.session.authenticated = true;
    req.session.username = username;
    req.session.save(() => {
        res.redirect('/');
    });
});


app.get('/members', (req, res) => {
    const catImage = [
        '/cutecat.jpg',
        '/suscat.jpg',
        '/fatcat.jpg'
    ]

    const randomIndex = Math.floor(Math.random() * catImage.length);
    const randomCat = catImage[randomIndex];
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        res.send(`<h1>Welcome to the members area, ${req.session.username}!</h1>
                <img src="${randomCat}" alt="Random Cat">
                <a href="/logout"><button>Logout</button></a>`);
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.use(express.static(path.join(__dirname, '/public')));


app.use((req, res) => {
    res.status(404).send('Page Not Found');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});