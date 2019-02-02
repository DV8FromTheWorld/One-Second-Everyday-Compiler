const {spawn, exec} = require('child_process')
const fs = require('fs')
const {promises: fsP} = fs

;(async () => {
  const time = Date.now()

  const dirs = (await fsP.readdir('.'))
    .sort((dir1, dir2) => {
      //Sort by date
      if (dir1 > dir2) return 1
      if (dir1 < dir2) return -1
      return 0
    })
    .map(dir => ({dir, date: getDateFromDir(dir)}))
    .filter(dirInfo => dirInfo.date) //Filter out any directories that are not date directories.

  const outputFiles = []
  const filesTxt = 'concatable-files.txt'
  const finalVideo = '1SE-video.mp4'

  const dateRange = `${dirs[0].date} - ${dirs[dirs.length - 1].date}`
  console.log(`Creating 1SE for range: ${dateRange}. Total Videos: ${dirs.length}`)

  const titleVideoFile = await createTitleVideo(dateRange)
  const endVideoFile   = await createEndingVideo()

  //Add the title video as the first video in the ones we concat.
  outputFiles.push(titleVideoFile)

  for (const {dir, date} of dirs) {
    const outputFile = await createSubtitledAndResizedVideo(dir, date)
    if (!outputFile) {
      continue
    }

    outputFiles.push(outputFile)
  }

  //Add the end video as the last video in the ones we concat.
  outputFiles.push(endVideoFile)

  await runCommand(`rm -rf ${filesTxt}`)
  await fsP.writeFile(filesTxt, outputFiles
    .map(file => `file ${file}`)
    .join('\n')
  )

  console.log("constructing video...")
  await runCommand(`rm -rf ${finalVideo}`)
  await runCommand(`ffmpeg -v error -safe 0 -f concat -i ${filesTxt} -c copy ${finalVideo}`)
  console.log(`Done! Total Time: ${(Date.now() - time) / 1000}s`)
})();

/**
 * Creates a title video with the provided date range as a subtitle.
 *
 * Based on: https://stackoverflow.com/a/22719247
 *
 * @param title
 * @param color
 * @param duration
 * @returns {Promise<void>}
 */
async function createTitleVideo(dateRange, duration = 2.5, color = '#2f3136') {
  process.stdout.write("Creating title video... ")

  const titleVideo = 'title-clip.mp4'
  const logoFile   = `${__dirname}/resources/logo-with-text.png`

  const lavfiArgs = [
    `color=c=${color}`,
    `s=1920x1080`,
    `d=${duration}`,
    `rate=30`
  ]

  const drawTextArgs = [
    `text='${dateRange}'`,
    `fontfile=/Windows/Fonts/mmrtextb.ttf`,
    `fontsize=70`,
    `fontcolor=white`,
    `shadowcolor=DarkSlateGray`,
    `shadowx=2`,
    `shadowy=2`,
    `x=(w-text_w)/2`,     //Center horizonally
    `y=(h+text_h+50)/2`,  //Center veritically. Move further down to place nice with logo-header.
  ]

  const filters = [
    `overlay=300:400`,
    `drawtext=${drawTextArgs.join(':')}`,
    `fade=in:0:30`,
  ]

  //Cleanup from possible previous runs
  await runCommand(`rm -rf ${titleVideo}`)
  await runCommand(`ffmpeg \
    -f lavfi -i "${lavfiArgs.join(':')}" \
    -i ${logoFile} \
    -f lavfi -i "anullsrc=r=48000:cl=stereo" \
    -filter_complex "[0:v][1:v] ${filters.join(',')}" \
    -map 0:v -map 1:v -map 2:a -shortest \
    -c:a aac \
    ${titleVideo}`)

  process.stdout.write("Done.\n")
  return titleVideo
}

async function createEndingVideo(duration = 4.0, color = '#2f3136') {
  process.stdout.write("Creating ending video... ")

  const endVideo = 'end-clip.mp4'
  const logoFile = `${__dirname}/resources/logo.png`

  const lavfiArgs = [
    `color=c=${color}`,
    `s=1920x1080`,
    `d=${duration}`,
    `rate=30`
  ]

  //Defaults
  const drawTextArgs = [
    `fontfile=/Windows/Fonts/mmrtextb.ttf`,
    `fontsize=45`,
    `fontcolor=white`,
    `shadowcolor=DarkSlateGray`,
    `shadowx=2`,
    `shadowy=2`,
    `x=(w-text_w)/2`, //Center horizonally
  ]

  const line1 = [
    `text='Brought to you by'`,
    `y=(h-text_h-text_h)/2`, //Center vertically. Move further up to play nice with dateRange
    ...drawTextArgs,
  ]

  const line2 = [
    `text='@DV8FromTheWorld, @mistersender, and @1SE'`,
    `y=(h+text_h)/2`,        //Center veritically. Move further down to place nice with header.
    ...drawTextArgs
  ]

  const totalFrames = Math.floor(duration * 30) //Roughly 30 frames per second
  const filters = [
    `overlay=870:270`,                //Overlay the icon
    `drawtext=${line1.join(':')}`,
    `drawtext=${line2.join(':')}`,
    `fade=in:0:20`,                   //Fade in over first 2/3 second
    `fade=out:${totalFrames - 30}:30` //Fade out over the last second
  ]

  await runCommand(`rm -rf ${endVideo}`)
  await runCommand(`ffmpeg -f lavfi -i "${lavfiArgs.join(':')}" -i ${logoFile} -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000" -filter_complex "[0:v][1:v] ${filters.join(',')}" -shortest -c:a aac ${endVideo}`)

  process.stdout.write("Done.\n")
  return endVideo
}

/**
 *
 * @param dir
 *
 * @return {string} path to newly created file
 */
async function createSubtitledAndResizedVideo(dir, date, usePreviousOutput = true) {

  const input = `./${dir}/clip.mp4`
  const output = `./${dir}/output.mp4`

  if (!fs.existsSync(input)) {
    console.log(`Did not find clip for folder ${dir}`)
    return
  }

  const outputFileAudioStream = await getAudioStream(output)
  if (usePreviousOutput && fs.existsSync(output) && outputFileAudioStream && isAudioCorrectFormat(outputFileAudioStream)) {
    console.log(`Reusing output for dir: ${dir}`)
    return output
  }

  const drawTextArgs = [
    `fontfile=/Windows/Fonts/mmrtextb.ttf`,
    `text='${date}'`,
    `fontsize=50`,
    `fontcolor=white`,
    `x=120`,
    `y=960`,
    `shadowcolor=DarkSlateGray`,
    `shadowx=2`,
    `shadowy=2`
  ]

  // console.log("Removing previous files...")
  await runCommand(`rm -f ${output}`)

  console.log(`Creating video. Dir: ${dir}, Date: ${date}`)
  const inputFileAudioStream = await getAudioStream(input)
  if (inputFileAudioStream) {
    if (isAudioCorrectFormat(inputFileAudioStream)) {
      await runCommand(`ffmpeg -i ${input} -vf "scale=1920x1080, drawtext=${drawTextArgs.join(':')}" -vcodec libx264 -vb 4000k -codec:a copy ${output}`)
    }
    else {
      console.log("Found audio stream, but it is in wrong format. Converting.")
      await runCommand(`ffmpeg -i ${input} -vf "scale=1920x1080, drawtext=${drawTextArgs.join(':')}" -vcodec libx264 -vb 4000k -codec:a aac -ar 48000 ${output}`)
    }
  }
  else {
    await runCommand(`ffmpeg -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000" -i ${input} -vf "scale=1920x1080, drawtext=${drawTextArgs.join(':')}" -vcodec libx264 -vb 4000k -shortest -codec:a aac ${output}`)
  }

  return output
}

async function getAudioStream(file) {
  try {
    const { stdout } = await runCommand(`ffprobe -i ${file} -v quiet -print_format json -show_streams -select_streams a`)
    const audioStreams = JSON.parse(stdout).streams

    return audioStreams[0]
  }
  catch (e) {
    return null
  }
}

function isAudioCorrectFormat(audioStream) {
  return audioStream.codec_name === 'aac' && audioStream.codec_time_base === '1/48000'
}

function getDateFromDir(dirname) {
  const dateRegex = /^([0-9]{4})([0-9]{2})([0-9]{2})$/

  let [_, year, month, day] = dateRegex.exec(dirname) || []
  if (!_) {
    return
  }

  //Month is a string of `MM`. Convert to number for array index lookup.
  month = +month

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ]

  return `${months[month]} ${day}, ${year}`
}

async function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      }

      resolve({
        stdout: stdout,
        stderr: stderr
      })
    })
  })
}

