const express = require('express');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex');
const Clarifai = require('clarifai');

const db = knex({
  client: 'pg',
  connection: {
    connectionString : process.env.DATABASE_URL,
    ssl: true
  }
});

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
	res.send('Success');
})

app.post("/signin", (req, res) => {
	const { email, password } = req.body;
	if (!email || !password) {
		return res.status(400).json('Incorrect Form Submission');
	}
	db.select('email', 'hash').from('login')
	.where('email', '=', email)
	.then(data => {
		const isValid = bcrypt.compareSync(password, data[0].hash);
		if (isValid) {
			return db.select('*').from('users')
			.where('email', '=', email)
			.then(user => {
				res.json(user[0]);
			})
			.catch(err => res.status(400).json('Unable to get user'));
		} else {
			res.status(400).json('Wrong Credentials');
		}
	})
	.catch(err => res.status(400).json('Wrong Credentials'));
})

app.post("/register", (req, res) => {
	const { name, email, password } = req.body;
	if (!email || !name || !password) {
		return res.status(400).json('Incorrect Form Submission');
	}
	const hash = bcrypt.hashSync(password);
	db.transaction(trx => {
		trx.insert({
			hash: hash,
			email: email
		})
		.into('login')
		.returning('email')
		.then(loginEmail => {
			return trx('users')
			.returning('*')
			.insert({
				email: loginEmail[0],
				name: name,
				joined: new Date()
			})
			.then(user => {
				res.json(user[0]);
			})
		})
		.then(trx.commit)
		.catch(trx.rollback);
	})
	.catch(err => res.status(400).json("Unable to register"));
})

app.get("/profile/:id", (req, res) => {
	const { id } = req.params;
	db.select('*').from('users').where({
		id: id
	})
	.then(user => {
		if (user.length) {
			res.json(user[0]);
		} else {
			res.status(400).json("Not Found");
		}
	})
	.catch(err => res.status(400).json("Error getting user"));
})

const api = new Clarifai.App({
  apiKey: '34de0203bc2944ffacbe4f88eaa35797'
});

app.put("/image", (req, res) => {
	const { id } = req.body;
	db('users').where('id', '=', id)
	.increment('entries', 1)
	.returning('entries')
	.then(entries => {
		res.json(entries[0]);
	})
	.catch(err => res.status(400).json('Unable to get entries'));
})

app.post("/imageurl", (req, res) => {
	api.models
	.predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
	.then(data => {
		res.json(data);
	})
	.catch(err => res.status(400).json('Unable to work with API'))
})

app.listen(process.env.PORT || 3000, () => {
	console.log(`App is Running on ${process.env.PORT}`);
});



/*
 / --> res = this is working
 /signin --> POST = success/fail
 /register --> POST = user
 /profile/:userId --> GET = user
 /image --> PUT --> user

*/