var Hyperdrive = require('dat-node')
var crypto = require('crypto')
var fs = require('fs')
var mkdirp = require('mkdirp')

function CabalClientFiles (arg) {
  if (!(this instanceof CabalClientFiles)) return new CabalClientFiles(arg)
  this.initialStoragePath = arg.storagePath
  this.allowSeedingList = arg.allowSeedingList || []
  this.hyperdrives = new Map()
}

CabalClientFiles.prototype.storagePath = function (userKey) {
  return this.initialStoragePath + userKey + '/'
}

CabalClientFiles.prototype.getDatKeyFromStoragePath = function (userKey) {
  var self = this
  return new Promise(function (resolve, reject) {
    var storagePath = self.storagePath(userKey)
    if (fs.existsSync(storagePath)) {
      var opts = {
        sparse: false,
        upload: true,
        download: true
      }
      Hyperdrive(storagePath, opts, function (err, hyperdrive) {
        if (err) {
          resolve(err)
        }
        hyperdrive.close()
        resolve(hyperdrive.key.toString('hex'))
      })
    } else {
      resolve()
    }
  })
}

CabalClientFiles.prototype.publish = async function (arg) {
  var self = this
  var storagePath = self.storagePath(arg.userKey)

  var fileDir = crypto.randomBytes(32).toString('hex')
  var filePath = storagePath + fileDir + '/'

  mkdirp.sync(filePath)
  fs.copyFileSync(arg.path, filePath + arg.name)

  var datData = {
    datKey: arg.datKey,
    userKey: arg.userKey
  }
  if (!self.hyperdrives.has(arg.datKey)) {
    console.warn('===> start new seed')
    datData = await self.seed(datData)
  }

  return new Promise(function (resolve, reject) {
    var hyperdrive = self.hyperdrives.get(datData.datKey)
    hyperdrive.importFiles(function () {
      var data = {
        datFileName: fileDir + '/' + arg.name,
        datKey: datData.datKey
      }
      resolve(data)
    })
  })
}

CabalClientFiles.prototype.seed = function (datData) {
  var self = this
  return new Promise(function (resolve, reject) {
    var storagePath = self.storagePath(datData.userKey)
    mkdirp.sync(storagePath)
    var datArgs = {
      sparse: false,
      upload: true,
      download: true
    }
    console.warn('===> Seed: start', { datData })
    if (datData.datKey) {
      datArgs.key = datData.datKey
      var hyperdrive = self.hyperdrives.get(datData.datKey)
      if (hyperdrive) {
        if (hyperdrive.network.connected) {
          // Return if already connected swarm of this dat
          console.warn('===> Seed: already connected', { datKey: datData.datKey })
          datData.hyperdrive = hyperdrive
          resolve(datData)
        }
      } else {
        self.hyperdrives.set(datData.datKey, undefined)
      }
    }
    Hyperdrive(storagePath, datArgs, function (err, hyperdrive) {
      if (err) throw reject(err)
      var datKey = hyperdrive.key.toString('hex')
      console.warn('===> Seed: joining Network.....', datKey)
      self.hyperdrives.set(datKey, hyperdrive)
      hyperdrive.joinNetwork(function () {
        datData.datKey = datKey
        datData.hyperdrive = hyperdrive
        console.warn('===> Seed: joined Network', { datKey, hyperdrive })
        resolve(datData)
      })
      // hyperdrive.network.on('connection', function (connection, info) {
      //  console.warn('===> Dat: on connection', { connection, info })
      // })
      // var stats = dat.trackStats()
      // var peers = stats.peers
    })
  })
}

CabalClientFiles.prototype.seedAll = function (allowSeedingList) {
  var self = this
  allowSeedingList = allowSeedingList || self.allowSeedingList
  allowSeedingList.forEach(function (datData) {
    self.seed(datData)
  })
}

CabalClientFiles.prototype.stopSeeding = function (datKey) {
  var self = this
  if (datKey) {
    // Stop seeding one
    var dat = self.hyperdrives.get(datKey)
    if (dat) {
      dat.close(function () {
        self.hyperdrives.delete(datKey)
      })
    }
  } else {
    // Stop seeding all
    self.hyperdrives.forEach(function (dat, datKey) {
      dat.close(function () {
        self.hyperdrives.delete(datKey)
      })
    })
  }
}

CabalClientFiles.prototype.fetch = async function (arg) {
  var self = this
  var datData = {
    datKey: arg.datKey,
    userKey: arg.userKey
  }
  var hyperdrive = self.hyperdrives.get(arg.datKey)
  if (!hyperdrive) {
    console.warn('===> Fetch: connecting...', { arg })
    datData = await self.seed(datData)
    hyperdrive = datData.hyperdrive
  }
  return new Promise(function (resolve, reject) {
    var storagePath = self.storagePath(arg.userKey)
    datData.archive = hyperdrive.archive
    datData.localPath = storagePath + arg.fileName

    hyperdrive.archive.readFile(arg.fileName, function (err, content) {
      if (err) {
        reject(err)
      }
      datData.content = content
      console.warn('===> Fetch: readfile...', content)
      resolve(datData)
    })
  })
}

module.exports = CabalClientFiles
