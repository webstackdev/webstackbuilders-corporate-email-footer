import gulp from 'gulp'
import htmlmin from 'gulp-htmlmin'
import htmllint from 'gulp-htmllint'
import fancyLog from 'fancy-log'
import colors from 'ansi-colors'
import fs from 'fs'
import path from 'path'
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

gulp.task('test:length', (done) => {
  const MAX_LENGTH = 10000 // Gmail maximum length
  const distDir = './dist'

  fancyLog(colors.cyan('[test:length] ') + colors.white('Running build to ensure current output...'))

  try {
    // Run the core build command first (without tests to avoid recursion)
    execSync('npm run build:core', { stdio: 'inherit' })

    let allValid = true
    let maxCharCount = 0

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

      maxCharCount = Math.max(maxCharCount, charCount)

      if (charCount <= MAX_LENGTH) {
        fancyLog(colors.green('✓ ') + colors.white(file) + colors.gray(` - ${charCount} characters (within Gmail limit)`))
      } else {
        fancyLog(colors.red('✗ ') + colors.white(file) + colors.red(` - ${charCount} characters (exceeds Gmail limit of ${MAX_LENGTH})`))
        allValid = false
      }
    })

    if (allValid) {
      fancyLog(colors.green('[test:length] ') + colors.white(`All ${distFiles.length} file(s) within Gmail character limit (${maxCharCount}/${MAX_LENGTH})`))
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