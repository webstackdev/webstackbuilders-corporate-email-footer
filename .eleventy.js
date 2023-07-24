module.exports = function (eleventyConfig) {
  return {
    // configuration object for directories
    dir: {
      // tells Eleventy where to look for global data
      data: "../_data",
      // Eleventy will look here for files to process
      input: "src/pages",
      // the built files will be placed here
      output: ".cache",
      // tells Eleventy where to look for layouts/partials
      includes: "../_partials",
    },
  };
}
