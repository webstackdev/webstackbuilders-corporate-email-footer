import gulp from 'gulp'
import htmlmin from 'gulp-htmlmin'
import htmllint from 'gulp-htmllint'
import fancyLog from 'fancy-log'
import colors from 'ansi-colors'
import fs from 'fs'
import path from 'path'
import isBase64 from 'is-base64'
import { execSync } from 'child_process'
import imageToBase64 from 'image-to-base64'
import imagemin from 'imagemin'
import imageminPngquant from 'imagemin-pngquant'

const htmlMinifierOptions = {
  collapseWhitespace: true,
}

gulp.task('minify', () => {
  return gulp
    .src('.cache/*.html')
    .pipe(htmlmin(htmlMinifierOptions))
    .pipe(gulp.dest('dist'))
})

const htmllintReporter = (filepath, issues) => {
  if (issues.length > 0) {
    issues.forEach(function (issue) {
      fancyLog(
        colors.cyan('[gulp-htmllint] ') +
        colors.white(filepath + ' [' + issue.line + ',' + issue.column + ']: ') +
        colors.red('(' + issue.code + ') ' + issue.msg)
      )
    })
    process.exitCode = 1
  }
}

gulp.task('lint', () => {
  return gulp
    .src('.cache/*.html')
    .pipe(htmllint({}, htmllintReporter))
})

gulp.task('test:image', (done) => {
  const imagesJsonPath = 'src/_data/images.json'
  
  if (!fs.existsSync(imagesJsonPath)) {
    fancyLog(colors.red('[test:image] ') + colors.red('images.json file not found. Run generate:images first.'))
    process.exitCode = 1
    done()
    return
  }

  const imagesData = JSON.parse(fs.readFileSync(imagesJsonPath, 'utf8'))
  const imageNames = Object.keys(imagesData)

  fancyLog(colors.cyan('[test:image] ') + colors.white(`Testing ${imageNames.length} images from images.json...`))

  let allValid = true

  imageNames.forEach(imageName => {
    const imageInfo = imagesData[imageName]
    const dataUri = imageInfo.dataUri

    if (dataUri && dataUri.startsWith('data:image/')) {
      // Extract the base64 part after the comma
      const base64Part = dataUri.split(',')[1]

      if (base64Part && isBase64(base64Part)) {
        fancyLog(colors.green('✓ ') + colors.white(`${imageName}.png`) + colors.gray(' - valid base64 image'))
      } else {
        fancyLog(colors.red('✗ ') + colors.white(`${imageName}.png`) + colors.red(' - invalid base64 encoding'))
        allValid = false
      }
    } else {
      fancyLog(colors.red('✗ ') + colors.white(`${imageName}.png`) + colors.red(' - invalid data URI format'))
      allValid = false
    }
  })

  if (allValid) {
    fancyLog(colors.green('[test:image] ') + colors.white('All images valid!'))
  } else {
    fancyLog(colors.red('[test:image] ') + colors.white('Some images have issues'))
    process.exitCode = 1
  }

  done()
})

gulp.task('test:length', (done) => {
  const MAX_LENGTH = 10000 // Gmail maximum length
  const distDir = './dist'

  fancyLog(colors.cyan('[test:length] ') + colors.white('Running build to ensure current output...'))

  try {
    // Run the core build command first (without tests to avoid recursion)
    execSync('npm run build:core', { stdio: 'inherit' })

    let allValid = true

    // Check image data from images.json
    fancyLog(colors.cyan('[test:length] ') + colors.white('Checking image character counts...'))
    const imagesJsonPath = 'src/_data/images.json'

    if (fs.existsSync(imagesJsonPath)) {
      const imagesData = JSON.parse(fs.readFileSync(imagesJsonPath, 'utf8'))
      const imageNames = Object.keys(imagesData)
      let totalImageChars = 0

      imageNames.forEach(imageName => {
        const imageInfo = imagesData[imageName]
        const charCount = imageInfo.dataUri.length

        totalImageChars += charCount
        fancyLog(colors.blue('ℹ ') + colors.white(`${imageName}.png`) + colors.gray(` - ${charCount} characters`))
      })

      // Check if total image size passes/fails against Gmail limit
      if (totalImageChars <= MAX_LENGTH) {
        fancyLog(colors.green('✓ ') + colors.white(`Total images: ${totalImageChars} characters (within Gmail limit)`))
      } else {
        fancyLog(colors.red('✗ ') + colors.white(`Total images: ${totalImageChars} characters (exceeds Gmail limit of ${MAX_LENGTH})`))
        allValid = false
      }

      fancyLog(colors.cyan('[test:length] ') + colors.white(`Images checked: ${imageNames.length} file(s)`))
    }

    fancyLog(colors.cyan('[test:length] ') + colors.white('Checking character counts in dist folder...'))

    if (!fs.existsSync(distDir)) {
      fancyLog(colors.red('✗ ') + colors.white('dist folder not found'))
      process.exitCode = 1
      done()
      return
    }

    const distFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.html'))

    if (distFiles.length === 0) {
      fancyLog(colors.yellow('? ') + colors.white('No HTML files found in dist folder'))
      done()
      return
    }

    distFiles.forEach(file => {
      const filePath = path.join(distDir, file)
      const content = fs.readFileSync(filePath, 'utf8')
      const charCount = content.length

      if (charCount <= MAX_LENGTH) {
        fancyLog(colors.green('✓ ') + colors.white(file) + colors.gray(` - ${charCount} characters (within Gmail limit)`))
      } else {
        fancyLog(colors.red('✗ ') + colors.white(file) + colors.red(` - ${charCount} characters (exceeds Gmail limit of ${MAX_LENGTH})`))
        allValid = false
      }
    })

    if (allValid) {
      fancyLog(colors.green('[test:length] ') + colors.white(`All ${distFiles.length} file(s) within Gmail character limit!`))
    } else {
      fancyLog(colors.red('[test:length] ') + colors.white('Some files exceed the Gmail character limit'))
      process.exitCode = 1
    }

  } catch (error) {
    fancyLog(colors.red('[test:length] ') + colors.red('Build failed: ' + error.message))
    process.exitCode = 1
  }

  done()
})

gulp.task('generate:images', async (done) => {
  const imagesDir = 'src/_data/images'
  const outputFile = 'src/_data/images.json'

  fancyLog(colors.cyan('[generate:images] ') + colors.white('Optimizing and converting PNG images to base64...'))

  try {
    const imageFiles = fs.readdirSync(imagesDir).filter(file => file.endsWith('.png'))
    const imagesData = {}

    for (const file of imageFiles) {
      const filePath = path.join(imagesDir, file)
      const fileName = path.basename(file, '.png')

      try {
        // First optimize the PNG with imagemin and pngquant
        fancyLog(colors.blue('⚙ ') + colors.white(file) + colors.gray(' - optimizing with pngquant...'))

        const optimizedFiles = await imagemin([filePath], {
          plugins: [
            imageminPngquant({
              quality: [0.05, 0.8], // Quality range for optimization
              speed: 4 // Speed vs quality trade-off (1-10, where 10 is fastest)
            })
          ]
        })

        if (optimizedFiles.length === 0) {
          throw new Error('No optimized files generated')
        }

        // Convert the optimized buffer to base64
        const optimizedBuffer = optimizedFiles[0].data
        const base64String = Buffer.from(optimizedBuffer).toString('base64')
        const dataUri = `data:image/png;base64,${base64String}`

        // Calculate size reduction
        const originalSize = fs.statSync(filePath).size
        const optimizedSize = optimizedBuffer.length
        const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1)

        imagesData[fileName] = {
          dataUri: dataUri,
          alt: fileName === 'logo' ? 'logo image' : `${fileName} icon`
        }

        fancyLog(colors.green('✓ ') + colors.white(file) + colors.gray(` - optimized (${reduction}% smaller) and converted to base64 (${base64String.length} chars)`))
      } catch (error) {
        fancyLog(colors.red('✗ ') + colors.white(file) + colors.red(` - processing failed: ${error.message}`))
      }
    }

    fs.writeFileSync(outputFile, JSON.stringify(imagesData, null, 2))
    fancyLog(colors.green('[generate:images] ') + colors.white(`Generated ${outputFile} with ${Object.keys(imagesData).length} optimized images`))

  } catch (error) {
    fancyLog(colors.red('[generate:images] ') + colors.red('Failed: ' + error.message))
  }

  done()
})