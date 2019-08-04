# Cabal Files [WIP]

Plugin for cabal clients for message file attachments shared via dat

## Example

```
import CabalFiles from 'cabal-client-files'


## Init and set path to store dats for the cabal

cabalFiles = CabalFiles({
  storagePath: FILES_DIR + '/' + cabal.key + '/'
})


## Publish a file message

var path = [local filesystem path to file]
var datKey = await cabalFiles.getDatKeyFromStoragePath(userKey)
let publishData = await cabalFiles.publish({ datKey, name, path, userKey: user.key })


## Swarm and download and get path to local dat file from a cabal message

let datData = await cabalFiles.fetch({
  datKey: message.value.content.file.key,
  fileName: message.value.content.file.name,
  userKey: message.key
})


## Seed your files

cabalFiles.getDatKeyFromStoragePath(user.key).then((datKey) => {
  if (datKey) {
    cabalFiles.currentUserFilesDatKey = datKey
    var dats = []
    dats.push({
      datKey: datKey,
      userKey: user.key
    })
    # Add other cabal user dats to seed etc....
    cabalFiles.seedAll(dats)
  }
})


```
