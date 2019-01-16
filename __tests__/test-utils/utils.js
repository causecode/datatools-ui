const {exec, spawn} = require('child_process')
const fs = require('fs')

const {safeDump, safeLoad} = require('js-yaml')
const request = require('request')

export const collectingCoverage = process.env.NODE_ENV === 'instrumented'
export const isCi = !!process.env.CI
export const isUiRepo = process.env.TRAVIS_REPO_SLUG === 'conveyal/datatools-ui'

/**
 * Download a file using a stream
 */
export function downloadFile (url, filename, callback) {
  console.log(`downloading file: ${url}`)
  const dlStream = request(url).pipe(fs.createWriteStream(filename))

  let callbackCalled = false

  // handle any error occurred while downloading file
  dlStream.on('error', (err) => {
    console.error(`Error downloading from: ${url}.  Error: ${err}`)
    callbackCalled = true
    if (!callbackCalled) callback(err)
  })

  dlStream.on('finish', () => {
    if (!callbackCalled) {
      callbackCalled = true
      console.log(`successfully downloaded file: ${filename}`)
      callback()
    }
  })
}

/**
 * Find and kill a process
 */
export function killDetachedProcess (processName, callback) {
  const pidFilename = `${processName}.pid`

  // open pid file to get pid
  fs.readFile(pidFilename, (err, data) => {
    if (err) {
      console.error(`pid file ${pidFilename} could not be read!`)
      return callback(err)
    }

    // attempt to kill process running with pid
    const cmd = `kill ${data}`
    console.log(cmd)
    exec(cmd, err => {
      if (err) {
        console.error(`pid ${data} could not be killed!`)
        return callback(err)
      }

      console.log('Kill command successful')

      // delete pid file
      fs.unlink(pidFilename, err => {
        if (err) {
          console.error(`pid file ${pidFilename} could not be deleted!`)
          return callback(err)
        }
        callback()
      })
    })
  })
}

/**
 * Load yaml from a file into a js object
 */
export function loadYamlFile (filename, callback) {
  fs.readFile(filename, (err, data) => {
    if (err) return callback(err)
    try {
      callback(null, safeLoad(data))
    } catch (e) {
      callback(e)
    }
  })
}

/**
 * Make sure certain environment variables are definted
 */
export function requireEnvVars (varnames) {
  const undefinedVars = []
  varnames.forEach(varname => {
    if (!process.env[varname]) {
      undefinedVars.push(varname)
    }
  })
  if (undefinedVars.length > 0) {
    throw new Error(`Required environment variables missing: ${undefinedVars.join(', ')}`)
  }
}

/**
 * Start a process that will continue to run after this script ends
 */
export function spawnDetachedProcess (cmd, args, name) {
  const processOut = fs.openSync(`./${name}-out.log`, 'w')
  const processErr = fs.openSync(`./${name}-err.log`, 'w')
  console.log(`${cmd} ${args.join(' ')}`)
  const child = spawn(
    cmd,
    args,
    { detached: true, stdio: [ 'ignore', processOut, processErr ] }
  )
  fs.writeFileSync(`${name}.pid`, child.pid)
  child.unref()
}

/**
 * Write a js object into a yaml formatted file
 */
export function writeYamlFile (filename, obj, callback) {
  fs.writeFile(filename, safeDump(obj), callback)
}