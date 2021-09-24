process.env.TESTENV = true

let Trainee = require('../app/models/trainee.js')
let User = require('../app/models/user')

const crypto = require('crypto')

let chai = require('chai')
let chaiHttp = require('chai-http')
let server = require('../server')
chai.should()

chai.use(chaiHttp)

const token = crypto.randomBytes(16).toString('hex')
let userId
let traineeId

describe('Trainees', () => {
  const traineeParams = {
    title: '13 JavaScript tricks SEI instructors don\'t want you to know',
    text: 'You won\'believe number 8!'
  }

  before(done => {
    Trainee.deleteMany({})
      .then(() => User.create({
        email: 'caleb',
        hashedPassword: '12345',
        token
      }))
      .then(user => {
        userId = user._id
        return user
      })
      .then(() => Trainee.create(Object.assign(traineeParams, {owner: userId})))
      .then(record => {
        traineeId = record._id
        done()
      })
      .catch(console.error)
  })

  describe('GET /trainees', () => {
    it('should get all the trainees', done => {
      chai.request(server)
        .get('/trainees')
        .set('Authorization', `Token token=${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.trainees.should.be.a('array')
          res.body.trainees.length.should.be.eql(1)
          done()
        })
    })
  })

  describe('GET /trainees/:id', () => {
    it('should get one trainee', done => {
      chai.request(server)
        .get('/trainees/' + traineeId)
        .set('Authorization', `Token token=${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.trainee.should.be.a('object')
          res.body.trainee.title.should.eql(traineeParams.title)
          done()
        })
    })
  })

  describe('DELETE /trainees/:id', () => {
    let traineeId

    before(done => {
      Trainee.create(Object.assign(traineeParams, { owner: userId }))
        .then(record => {
          traineeId = record._id
          done()
        })
        .catch(console.error)
    })

    it('must be owned by the user', done => {
      chai.request(server)
        .delete('/trainees/' + traineeId)
        .set('Authorization', `Bearer notarealtoken`)
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should be succesful if you own the resource', done => {
      chai.request(server)
        .delete('/trainees/' + traineeId)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(204)
          done()
        })
    })

    it('should return 404 if the resource doesn\'t exist', done => {
      chai.request(server)
        .delete('/trainees/' + traineeId)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(404)
          done()
        })
    })
  })

  describe('POST /trainees', () => {
    it('should not POST an trainee without a title', done => {
      let noTitle = {
        text: 'Untitled',
        owner: 'fakedID'
      }
      chai.request(server)
        .post('/trainees')
        .set('Authorization', `Bearer ${token}`)
        .send({ trainee: noTitle })
        .end((e, res) => {
          res.should.have.status(422)
          res.should.be.a('object')
          done()
        })
    })

    it('should not POST an trainee without text', done => {
      let noText = {
        title: 'Not a very good trainee, is it?',
        owner: 'fakeID'
      }
      chai.request(server)
        .post('/trainees')
        .set('Authorization', `Bearer ${token}`)
        .send({ trainee: noText })
        .end((e, res) => {
          res.should.have.status(422)
          res.should.be.a('object')
          done()
        })
    })

    it('should not allow a POST from an unauthenticated user', done => {
      chai.request(server)
        .post('/trainees')
        .send({ trainee: traineeParams })
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should POST an trainee with the correct params', done => {
      let validTrainee = {
        title: 'I ran a shell command. You won\'t believe what happened next!',
        text: 'it was rm -rf / --no-preserve-root'
      }
      chai.request(server)
        .post('/trainees')
        .set('Authorization', `Bearer ${token}`)
        .send({ trainee: validTrainee })
        .end((e, res) => {
          res.should.have.status(201)
          res.body.should.be.a('object')
          res.body.should.have.property('trainee')
          res.body.trainee.should.have.property('title')
          res.body.trainee.title.should.eql(validTrainee.title)
          done()
        })
    })
  })

  describe('PATCH /trainees/:id', () => {
    let traineeId

    const fields = {
      title: 'Find out which HTTP status code is your spirit animal',
      text: 'Take this 4 question quiz to find out!'
    }

    before(async function () {
      const record = await Trainee.create(Object.assign(traineeParams, { owner: userId }))
      traineeId = record._id
    })

    it('must be owned by the user', done => {
      chai.request(server)
        .patch('/trainees/' + traineeId)
        .set('Authorization', `Bearer notarealtoken`)
        .send({ trainee: fields })
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should update fields when PATCHed', done => {
      chai.request(server)
        .patch(`/trainees/${traineeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ trainee: fields })
        .end((e, res) => {
          res.should.have.status(204)
          done()
        })
    })

    it('shows the updated resource when fetched with GET', done => {
      chai.request(server)
        .get(`/trainees/${traineeId}`)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.should.be.a('object')
          res.body.trainee.title.should.eql(fields.title)
          res.body.trainee.text.should.eql(fields.text)
          done()
        })
    })

    it('doesn\'t overwrite fields with empty strings', done => {
      chai.request(server)
        .patch(`/trainees/${traineeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ trainee: { text: '' } })
        .then(() => {
          chai.request(server)
            .get(`/trainees/${traineeId}`)
            .set('Authorization', `Bearer ${token}`)
            .end((e, res) => {
              res.should.have.status(200)
              res.body.should.be.a('object')
              // console.log(res.body.trainee.text)
              res.body.trainee.title.should.eql(fields.title)
              res.body.trainee.text.should.eql(fields.text)
              done()
            })
        })
    })
  })
})
