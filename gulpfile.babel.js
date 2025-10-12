import gulp from 'gulp'
import htmlmin from 'gulp-htmlmin'
import htmllint from 'gulp-htmllint'
import fancyLog from 'fancy-log'
import colors from 'ansi-colors'
import fs from 'fs'
import path from 'path'
import isBase64 from 'is-base64'
import { execSync } from 'child_process'

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
  const imagesDir = 'src/_partials/images'
  const imageFiles = fs.readdirSync(imagesDir).filter(file => file.endsWith('.njk'))

  fancyLog(colors.cyan('[test:image] ') + colors.white(`Testing ${imageFiles.length} image templates...`))

  let allValid = true

  imageFiles.forEach(file => {
    const filePath = path.join(imagesDir, file)
    const content = fs.readFileSync(filePath, 'utf8')

    // Extract src="" content using regex
    const srcMatch = content.match(/src="([^"]+)"/)

    if (srcMatch) {
      const srcValue = srcMatch[1]

      // Check if it's a base64 data URI
      if (srcValue.startsWith('data:image/')) {
        // Extract the base64 part after the comma
        const base64Part = srcValue.split(',')[1]

        if (base64Part && isBase64(base64Part)) {
          fancyLog(colors.green('✓ ') + colors.white(file) + colors.gray(' - valid base64 image'))
        } else {
          fancyLog(colors.red('✗ ') + colors.white(file) + colors.red(' - invalid base64 encoding'))
          allValid = false
        }
      } else {
        fancyLog(colors.yellow('? ') + colors.white(file) + colors.yellow(' - not a data URI'))
        allValid = false
      }
    } else {
      fancyLog(colors.red('✗ ') + colors.white(file) + colors.red(' - no src attribute found'))
      allValid = false
    }
  })

  if (allValid) {
    fancyLog(colors.green('[test:image] ') + colors.white('All image templates valid!'))
  } else {
    fancyLog(colors.red('[test:image] ') + colors.white('Some image templates have issues'))
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
    
    // Check image template files first
    fancyLog(colors.cyan('[test:length] ') + colors.white('Checking image template character counts...'))
    const imagesDir = 'src/_partials/images'
    
    if (fs.existsSync(imagesDir)) {
      const imageFiles = fs.readdirSync(imagesDir).filter(file => file.endsWith('.njk'))
      let totalImageChars = 0
      
      imageFiles.forEach(file => {
        const filePath = path.join(imagesDir, file)
        const content = fs.readFileSync(filePath, 'utf8')
        const charCount = content.length
        totalImageChars += charCount
        
        fancyLog(colors.blue('ℹ ') + colors.white(file) + colors.gray(` - ${charCount} characters`))
      })
      
      // Check if total image size passes/fails against Gmail limit
      if (totalImageChars <= MAX_LENGTH) {
        fancyLog(colors.green('✓ ') + colors.white(`Total image templates: ${totalImageChars} characters (within Gmail limit)`))
      } else {
        fancyLog(colors.red('✗ ') + colors.white(`Total image templates: ${totalImageChars} characters (exceeds Gmail limit of ${MAX_LENGTH})`))
        allValid = false
      }
      
      fancyLog(colors.cyan('[test:length] ') + colors.white(`Image templates checked: ${imageFiles.length} file(s)`))
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