process.env.TESTENV = true

let Program = require('../app/models/program.js')
let User = require('../app/models/user')

const crypto = require('crypto')

let chai = require('chai')
let chaiHttp = require('chai-http')
let server = require('../server')
chai.should()

chai.use(chaiHttp)

const token = crypto.randomBytes(16).toString('hex')
let userId
let programId

describe('programs', () => {
  const programParams = {
    title: '13 JavaScript tricks SEI instructors don\'t want you to know',
    text: 'You won\'believe number 8!'
  }

  before(done => {
    Program.deleteMany({})
      .then(() => User.create({
        email: 'caleb',
        hashedPassword: '12345',
        token
      }))
      .then(user => {
        userId = user._id
        return user
      })
      .then(() => Program.create(Object.assign(programParams, {owner: userId})))
      .then(record => {
        programId = record._id
        done()
      })
      .catch(console.error)
  })

  describe('GET /programs', () => {
    it('should get all the programs', done => {
      chai.request(server)
        .get('/programs')
        .set('Authorization', `Token token=${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.programs.should.be.a('array')
          res.body.programs.length.should.be.eql(1)
          done()
        })
    })
  })

  describe('GET /programs/:id', () => {
    it('should get one program', done => {
      chai.request(server)
        .get('/programs/' + programId)
        .set('Authorization', `Token token=${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.program.should.be.a('object')
          res.body.program.title.should.eql(programParams.title)
          done()
        })
    })
  })

  describe('DELETE /programs/:id', () => {
    let programId

    before(done => {
      Program.create(Object.assign(programParams, { owner: userId }))
        .then(record => {
          programId = record._id
          done()
        })
        .catch(console.error)
    })

    it('must be owned by the user', done => {
      chai.request(server)
        .delete('/programs/' + programId)
        .set('Authorization', `Bearer notarealtoken`)
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should be succesful if you own the resource', done => {
      chai.request(server)
        .delete('/programs/' + programId)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(204)
          done()
        })
    })

    it('should return 404 if the resource doesn\'t exist', done => {
      chai.request(server)
        .delete('/programs/' + programId)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(404)
          done()
        })
    })
  })

  describe('POST /programs', () => {
    it('should not POST an program without a title', done => {
      let noTitle = {
        text: 'Untitled',
        owner: 'fakedID'
      }
      chai.request(server)
        .post('/programs')
        .set('Authorization', `Bearer ${token}`)
        .send({ program: noTitle })
        .end((e, res) => {
          res.should.have.status(422)
          res.should.be.a('object')
          done()
        })
    })

    it('should not POST an program without text', done => {
      let noText = {
        title: 'Not a very good program, is it?',
        owner: 'fakeID'
      }
      chai.request(server)
        .post('/programs')
        .set('Authorization', `Bearer ${token}`)
        .send({ program: noText })
        .end((e, res) => {
          res.should.have.status(422)
          res.should.be.a('object')
          done()
        })
    })

    it('should not allow a POST from an unauthenticated user', done => {
      chai.request(server)
        .post('/programs')
        .send({ program: programParams })
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should POST an program with the correct params', done => {
      let validProgram = {
        title: 'I ran a shell command. You won\'t believe what happened next!',
        text: 'it was rm -rf / --no-preserve-root'
      }
      chai.request(server)
        .post('/programs')
        .set('Authorization', `Bearer ${token}`)
        .send({ program: validProgram })
        .end((e, res) => {
          res.should.have.status(201)
          res.body.should.be.a('object')
          res.body.should.have.property('program')
          res.body.program.should.have.property('title')
          res.body.program.title.should.eql(validProgram.title)
          done()
        })
    })
  })

  describe('PATCH /programs/:id', () => {
    let programId

    const fields = {
      title: 'Find out which HTTP status code is your spirit animal',
      text: 'Take this 4 question quiz to find out!'
    }

    before(async function () {
      const record = await Program.create(Object.assign(programParams, { owner: userId }))
      programId = record._id
    })

    it('must be owned by the user', done => {
      chai.request(server)
        .patch('/programs/' + programId)
        .set('Authorization', `Bearer notarealtoken`)
        .send({ program: fields })
        .end((e, res) => {
          res.should.have.status(401)
          done()
        })
    })

    it('should update fields when PATCHed', done => {
      chai.request(server)
        .patch(`/programs/${programId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ program: fields })
        .end((e, res) => {
          res.should.have.status(204)
          done()
        })
    })

    it('shows the updated resource when fetched with GET', done => {
      chai.request(server)
        .get(`/programs/${programId}`)
        .set('Authorization', `Bearer ${token}`)
        .end((e, res) => {
          res.should.have.status(200)
          res.body.should.be.a('object')
          res.body.program.title.should.eql(fields.title)
          res.body.program.text.should.eql(fields.text)
          done()
        })
    })

    it('doesn\'t overwrite fields with empty strings', done => {
      chai.request(server)
        .patch(`/programs/${programId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ program: { text: '' } })
        .then(() => {
          chai.request(server)
            .get(`/programs/${programId}`)
            .set('Authorization', `Bearer ${token}`)
            .end((e, res) => {
              res.should.have.status(200)
              res.body.should.be.a('object')
              // console.log(res.body.program.text)
              res.body.program.title.should.eql(fields.title)
              res.body.program.text.should.eql(fields.text)
              done()
            })
        })
    })
  })
})
