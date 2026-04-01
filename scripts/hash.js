const bcrypt = require('bcryptjs')
const hash = bcrypt.hashSync('root1234', 10)
console.log(hash)