const fs         = require('fs')
const { exec }   = require('child_process')
const fsPromises = fs.promises

const Filter           = require('./ffmpeg/Filter')
const DrawTextFilter   = require('./ffmpeg/filters/DrawTextFilter')
const BlankAudioFilter = require('./ffmpeg/filters/BlankAudioFilter')

const SHOULD_REUSE_VIDEOS = false
const BLANK_AUDIO_LAVFI_FILTER = new BlankAudioFilter()

;(async () => {
  const time = Date.now()

  //Look for directories in the current working directory.
  const dirs = (await fsPromises.readdir('.'))
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
    const outputFile = await createSubtitledAndResizedVideo(dir, date, SHOULD_REUSE_VIDEOS)
    if (!outputFile) {
      continue
    }

    outputFiles.push(outputFile)
  }

  //Add the end video as the last video in the ones we concat.
  outputFiles.push(endVideoFile)

  await fsPromises.unlink(filesTxt)
  await fsPromises.writeFile(filesTxt, outputFiles
    .map(file => `file ${file}`)
    .join('\n')
  )

  console.log("constructing video...")
  await fsPromises.unlink(finalVideo)
  await runCommand(`ffmpeg -v error -safe 0 -f concat -i ${filesTxt} -c copy ${finalVideo}`)
  console.log(`Done! Total Time: ${(Date.now() - time) / 1000}s`)
})();

/**
 * Creates a title video with the provided date range as a subtitle.
 *
 * Based on: https://stackoverflow.com/a/22719247
 *
 * @param dateRange
 * @param backgroundColor
 * @param duration
 * @returns {Promise<String>}
 */
async function createTitleVideo(dateRange, duration = 2.5, backgroundColor = '#2f3136') {
  process.stdout.write("Creating title video... ")

  const titleVideo = 'title-clip.mp4'
  const logoFile   = `${__dirname}/../resources/logo-with-text.png`

  //These arguments will generate a video stream using lavfi
  // that will be a solid color background for us to place things on.
  const solidColorLavfiFilter = new Filter('color', [
    `c=${backgroundColor}`,
    `s=1920x1080`,
    `d=${duration}`,
    `rate=30`
  ])

  //This filter will draw our date-range text on the screen.
  //It is applied as part of the compound filter input to -filter_complex
  const dateRangeTextFilter = new DrawTextFilter({
    text: dateRange,
    fontSize: 70,
    x: `(w-text_w)/2`,    //Center horizontally
    y: `(h+text_h+50)/2`, //Center vertically. Move further down to place nice with logo-header.
  })

  //This compound filter overlays the logo (provided as stream 1) and also overlays the title card date-range text.
  //This is the input to -filter_complex
  const overlayFilterChain = [
    `overlay=300:400`,             //Overlays the logo starting at 300x by 400y
    dateRangeTextFilter.compile(), //Overlays the title text just below the logo
    `fade=in:0:30`,                //Tells the filter to fade the content in, starting at frame 0 and ending at frame 30. (1 full second)
  ]

  //Cleanup from possible previous runs
  await fsPromises.unlink(titleVideo)
  await runCommand(`ffmpeg`
    + ` -f lavfi -i "${solidColorLavfiFilter.compile()}"`    //Generate the background video        [stream 0]
    + ` -i ${logoFile}`                                      //Add our logo to the resource streams [stream 1]
    + ` -f lavfi -i "${BLANK_AUDIO_LAVFI_FILTER.compile()}"` //Generate a blank audio track so that the full-video still has audio. [stream 2]
    + ` -filter_complex "[0:v][1:v] ${overlayFilterChain.join(',')}"` //Combine our first and second video sources (background color and logo) and overlay the title text
    + ` -map 0:v -map 1:v -map 2:a`                          //Compile the video together, using video from streams 0 and 1, and audio from stream 2.
    + ` -shortest`                                           //Clip the length of the video to the shortest stream.
    + ` -c:a aac`                                            //Ensure that the audio codec used in the output is AAC.
    + ` ${titleVideo}`)

  process.stdout.write("Done.\n")
  return titleVideo
}

/**
 * Creates the ending card with credits
 *
 * @param {number} duration - Time in seconds (supports floats) to show the clip
 * @param {String} backgroundColor - The background color used to fill the card. Must be prepended with # if it is a hex number.
 *
 * @returns {Promise<string>} - Promise resolving to the filename of the ending video clip
 */
async function createEndingVideo(duration = 4.0, backgroundColor = '#2f3136') {
  process.stdout.write("Creating ending video... ")

  const endVideo = 'end-clip.mp4'
  const logoFile = `${__dirname}/../resources/logo.png`

  //These arguments will generate a video stream using lavfi
  // that will be a solid color background for us to place things on.
  const solidColorLavfiFilter = new Filter('color', [
    `c=${backgroundColor}`,
    `s=1920x1080`,
    `d=${duration}`,
    `rate=30`
  ])

  //Create a filter that will draw the first line of text
  const creditsLine1Filter = new DrawTextFilter({
    text: `Brought to you by`,
    fontSize: 45,
    x: `(w-text_w)/2`,        //Center horizonally
    y: `(h-text_h-text_h)/2`, //Center vertically. Move further up to play nice with second-line
  })

  //Create a filter that will draw the second line of text
  const creditsLine2Filter = new DrawTextFilter({
    text: `@DV8FromTheWorld, @mistersender, and @1SE`,
    fontSize: 45,
    x: `(w-text_w)/2`, //Center horizonally
    y: `(h+text_h)/2`, //Center veritically. Move further down to place nice with first-line.
  })

  const totalFrames = Math.floor(duration * 30) //Roughly 30 frames per second
  const overlayFilterChain = [
    `overlay=870:270`,                //Overlay the logo starting at 870x - 270y
    creditsLine1Filter.compile(),     //Add the first line of text
    creditsLine2Filter.compile(),     //Add the second line of text
    `fade=in:0:20`,                   //Fade in over first 20 frames. (2/3rds a second) (start at 0 frame, fade for 20 frames)
    `fade=out:${totalFrames - 30}:30` //Fade out over the last 30 frames (1 full second) (start end-30, then fade for 30 frames)
  ]

  await fsPromises.unlink(endVideo)
  await runCommand(`ffmpeg`
    + ` -f lavfi -i "${solidColorLavfiFilter.compile()}"`    //Generate the background video        [stream 0]
    + ` -i ${logoFile}`                                      //Add our logo to the resource streams [stream 1]
    + ` -f lavfi -i "${BLANK_AUDIO_LAVFI_FILTER.compile()}"` //Generate a blank audio track so that the full-video still has audio. [stream 2]
    + ` -filter_complex "[0:v][1:v] ${overlayFilterChain.join(',')}"` //Combines our first and second video sources (background color and logo) and overlays the ending text
    + ` -shortest`                                           //Clip the length of the video to the shortest stream.
    + ` -c:a aac`                                            //Ensure that the audio codec used in the output is AAC.
    + ` ${endVideo}`)

  process.stdout.write("Done.\n")
  return endVideo
}

/**
 * Function which grabs the clip, runs it through a set of filters to normalize the video and audio encoding,
 *  ensures correct display size, and overlays a date stamp in the bottom-left corner.
 *
 * @param {String} dir - The directory to look for the 'clip.mp4' file in
 * @param {String} date - The date string to add to the video as a date-stamp
 * @param {Boolean} usePreviousOutput - If the program is being re-run, should it reuse any already-created 'output.mp4' files found?
 *
 * @returns {Promise<string>} - A promise that resolves to the path of the newly generated video, nor null if no 'clip.mp4' was found.
 */
async function createSubtitledAndResizedVideo(dir, date, usePreviousOutput = true) {
  const input  = `./${dir}/clip.mp4`
  const output = `./${dir}/output.mp4`

  if (!fs.existsSync(input)) {
    console.log(`Did not find clip for folder ${dir}`)
    return null
  }

  const outputFileAudioStream = await getAudioStream(output)
  if (usePreviousOutput && fs.existsSync(output) && outputFileAudioStream && isAudioCorrectFormat(outputFileAudioStream) && await isVideo30FPS(output)) {
    console.log(`Reusing output for dir: ${dir}`)
    return output
  }

  console.log(`Creating video. Dir: ${dir}, Date: ${date}`)

  //Create a filter that will draw the date timestamp
  const dateTextFilter = new DrawTextFilter({
    text: date,
    fontSize: 45,
    x: `120`,
    y: `960`,
  })

  const videoFilters = [
    `scale=1920x1080`,       //Ensure that the video is 1920x1080
    dateTextFilter.compile() //Overlay the datestamp onto the clip
  ]

  const inputFileAudioStream = await getAudioStream(input)

  const videoManipulationArgs = ``
    + ` -vf "${videoFilters.join(',')}"` //Apply filters to the video. Adds the date timestamp and ensures 1920x1080
    + ` -vcodec libx264`                 //Ensure that the video is encoded with x264 (H.264)
    + ` -r 30`                           //Ensure that the framerate is exactly 30 frames per second
    + ` -vb 4000k`                       //Ensure that the bitrate of the video is consistent for all videos
    + ` -pix_fmt yuv420p`                //Ensure that we use yuv420p, even when the source video had pixel information it can't represent

  let audioManipulationArgs
  let generatedAudioSrc = ''
  if (inputFileAudioStream) {
    if (isAudioCorrectFormat(inputFileAudioStream)) {
      audioManipulationArgs = `-codec:a copy` //If the audio is in the correct formats, take it without re-encoding
    }
    else {
      console.log("Found audio stream, but it is in wrong format. Converting.")
      audioManipulationArgs = `-codec:a aac -ar 48000` //Re-encode the audio in the AAC format and ensure a rate of 48k
    }
  }
  else {
    //If the clip has no audio channel, we will need to generate audio for it.
    //If we don't generate audio for this video, then when we compile all of the videos together, the full video itself
    // wont have any audio at all because of how ffmpeg's -concat flag works.
    generatedAudioSrc = `-f lavfi -i "${BLANK_AUDIO_LAVFI_FILTER.compile()}"`

    //Additionally, make sure that the generated audio is in the AAC format.
    audioManipulationArgs = `-codec:a aac`
  }

  await fsPromises.unlink(output)
  await runCommand(`ffmpeg`
    + ` -i ${input}`              //The original file.
    + ` ${generatedAudioSrc}`     //If we needed to generate audio, then include the filter to do that
    + ` ${videoManipulationArgs}` //Manipulate the video to have the properties we want
    + ` ${audioManipulationArgs}` //Manipulate the audio to have the properties we want
    + ` -shortest`                //Make sure to only create a clip for as long as the shortest stream
    + ` ${output}`)

  return output
}

async function getFileStreams(file, type) {
  const ffprobeCommand = `ffprobe`
    + ` -i ${file}`              //The file we're generating info about
    + ` -v quiet`                //Don't output the debug information
    + ` -print_format json`      //Print requested information as JSON for simple parsing
    + ` -show_streams`           //Show the streams section as we're looking for video stream information
    + ` -select_streams ${type}` //Grab only the sought after stream type.

  try {
    const { stdout } = await runCommand(ffprobeCommand)

    return JSON.parse(stdout).streams
  }
  catch (e) {
    return []
  }
}

async function isVideo30FPS(file) {
  try {
    const videoStreams = getFileStreams(file, 'v')

    //We can safely assume that there will only be a single video stream in the source file.
    //If there is more, we don't really know how to handle that.
    const avgFrameRate = videoStreams[0].avg_frame_rate

    return avgFrameRate && eval(avgFrameRate) === 30
  }
  catch (e) {
    return false
  }
}

async function getAudioStream(file) {
  try {
    const audioStreams = getFileStreams(file, 'a')
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
  const oneSecondEverydayDateRegex = /^([0-9]{4})([0-9]{2})([0-9]{2})$/

  let year, month, day

  //If the folder format is from 1SE, then pull out our info
  if (oneSecondEverydayDateRegex.test(dirname)) {
    [_, year, month, day] = oneSecondEverydayDateRegex.exec(dirname)

    //Month is a string of `MM`. Convert to number for array index lookup.
    month = +month
  }
  else {
    //Otherwise, assume the format of YYYY-MM-DD
    [year, month, day] = dirname.split("-")

    //Month is a string of `MM`. Convert to number for array index lookup.
    //Additionally, this format is 1-based, so convert to 0-based for array index lookup.
    month = +month - 1
  }
  
  if (!year || !day || isNaN(month)) {
    return
  }

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
  //Save the current stacktrace location for use in printing errors
  const contextErr = new Error('context')

  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        //Capture the err message and replace the contextErr's message so that we show
        // the correct error message _and_ the correct contextual stack trace.
        contextErr.message = err.message
        reject(contextErr)
      }

      resolve({
        stdout: stdout,
        stderr: stderr
      })
    })
  })
}
