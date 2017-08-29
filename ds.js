
// run these commands to download images and generate a file list.
//    cd /Users/olivierbouwman/Sites/devsigner
//    instagram-scraper devsigner,devsigner2017,devsigner17,devsigner2016,devsigner16,dvsgnrcon,dvsgnrcon2017,dvsgnrcon17,dvsgnrcon2016,dvsgnrcon16,dvsgnr,dvsgnr2017,dvsgnr17,dvsgnr2016,dvsgnr16 -t=image --tag -d devsigner --media_metadata
//    instagram-scraper devsignercon -d devsigner
//    instagram-scraper --location=1862978 (should only include new photos)
//    ./generate_file_list.py devsigner > devsigner-files.json

// TODO
// batch script to loop terminal commands with a 10 second pause in between.
// change resolution to 1920x1080 for HD projector
// possibly use image age for something so newer images are more prominent than older images (need to load photo timestamp from json files in image dir)
// some photos are not square, crop? look for this in instagram scraper and comment out: # get non-square image if one exists
// only include images in generate_file_list.py

var timeBetweenImagePlacement = 100;
var timeDelayAfterAddingImages = 10 * 1000;
var brightenLightImages = 50;
var brightenDarkImages = -50;
var imageHeight = 100;
var imageWidth = 100;
var jsonFile = "devsigner-files.json";
var darkPixels = countDarkPixels();
var reuseImages = false;
var canvas;
var ctx;

$(document).ready(function() {
  canvas = $(document).find("canvas")[0];
  ctx = canvas.getContext("2d");
  loadFiles();
});

function loadFiles() {
  var fileArray = [];
  var fileCounter = 0
  $.getJSON( jsonFile, function( data ) {
    fileCounter = data["children"].length;
    $.each( data["children"], function( key, val ) {
      getImageBrightness(val["path"],function(brightness) {
        if (brightness >= 0) {
          fileArray.push({path: val["path"], brightness: brightness});
        }
        fileCounter--;
        if (fileCounter === 0) {
          fileArray.sort(function(a, b) {
            return a.brightness - b.brightness;
          });
          determineImagePlacement(fileArray);
        }
      });
    });
  });
}

function determineImagePlacement(fileArray) {
  var imageArrayDark = fileArray.slice(0, darkPixels);
  var imageArrayLight = fileArray.slice(-darkPixels);
  // var imageArrayDark = fileArray.slice(0, Math.floor(Math.floor(fileArray.length)/2));
  // var imageArrayLight = fileArray.slice(-(Math.floor(Math.floor(fileArray.length)/2)));
  var brighten;
  var imageArray = [];
  pixelArray = loadMasterImage();
  pixelArray = shuffleArray(pixelArray);
  $.each( pixelArray, function( key, val ) {
    if (val.shade === 0) {
      var image = imageArrayLight[imageArrayLight.length-1];
      if (imageArrayLight.length > 0) {
        imageArrayLight.splice(-1, 1);
      }
      if (reuseImages === true && imageArrayLight.length < 1) {
        imageArrayLight = fileArray.slice(-(Math.floor(Math.floor(fileArray.length)/2)));
      }
      var brighten = brightenLightImages;
    }
    else {
      var image = imageArrayDark[0];
      if (imageArrayDark.length > 0) {
        imageArrayDark.splice(0, 1);
      }
      if (reuseImages === true && imageArrayDark.length < 1) {
        imageArrayDark = fileArray.slice(0, Math.floor(Math.floor(fileArray.length)));
      }
      var brighten = brightenDarkImages;
    }
    if (image) {
      imageArray.push({imagePath: image['path'], x: val.x, y: val.y, brighten: brighten});
    }
  });
  drawSquares(imageArray, 'add');
}

function drawSquares(imageArray, mode) {
  var index = 0;
  var timeDelay = 0;
  if (mode == "add") {
    timeDelay = timeDelayAfterAddingImages;
  }
  $.each( imageArray, function( key, val) {
    index++;
    setTimeout(function(){
      if (mode == "add") {
        var img = new Image;
        img.src = val.imagePath;
        img.onload = function() {
          ctx.drawImage(this, val.x * imageWidth, val.y * imageHeight, imageWidth, imageHeight);
          if (val.brighten !== 0) {
            imageData = ctx.getImageData(val.x * imageWidth, val.y * imageHeight, imageWidth, imageHeight),
            canvasPixelArray = imageData.data,
            canvasPixelArrayLength = canvasPixelArray.length,
            i = 0;
            for (; i < canvasPixelArrayLength; i += 4) {
              canvasPixelArray[i] += val.brighten;
              canvasPixelArray[i + 1] += val.brighten;
              canvasPixelArray[i + 2] += val.brighten;
            }
            ctx.putImageData(imageData, val.x * imageWidth, val.y * imageHeight);
          }
        };
      }
      else { //mode == "remove"
        ctx.clearRect(val.x * imageWidth, val.y * imageHeight, imageWidth, imageHeight);
      }
    }, index * timeBetweenImagePlacement);
  });
  setTimeout(function(){
    if (mode === "add") {
      drawSquares(imageArray, 'remove');
    }
    else {
      loadFiles();
    }
  }, (index * timeBetweenImagePlacement) + timeDelay);
}

function countDarkPixels() {
  pixelArray = loadMasterImage();
  darkPixels = 0;
  $.each( pixelArray, function( key, val ) {
    if (val.shade === 1) {
      darkPixels++;
    }
  });
  return darkPixels;
}

function getImageBrightness(imageSrc,callback) {
    var img = document.createElement("img");
    var colorSum = 0;
    img.src = imageSrc;
    img.style.display = "none";
    img.onload = function() {
        // create canvas
        var canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;

        var ctx = canvas.getContext("2d");
        ctx.drawImage(this,0,0);

        var imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
        var data = imageData.data;
        var r,g,b,avg;

        for(var x = 0, len = data.length; x < len; x+=4) {
            r = data[x];
            g = data[x+1];
            b = data[x+2];

            avg = Math.floor((r+g+b)/3);
            colorSum += avg;
        }

        var brightness = Math.floor(colorSum / (this.width*this.height));
        callback(brightness);
    }
    img.onerror = function() {
      callback(-1);
    };
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function loadMasterImage() {
  var arr = [];
  arr.push({x: 0, y: 0, shade: 0});
  arr.push({x: 1, y: 0, shade: 0});
  arr.push({x: 2, y: 0, shade: 0});
  arr.push({x: 3, y: 0, shade: 0});
  arr.push({x: 4, y: 0, shade: 0});
  arr.push({x: 5, y: 0, shade: 0});
  arr.push({x: 6, y: 0, shade: 0});
  arr.push({x: 7, y: 0, shade: 0});
  arr.push({x: 8, y: 0, shade: 0});
  arr.push({x: 9, y: 0, shade: 0});
  arr.push({x: 10, y: 0, shade: 0});
  arr.push({x: 11, y: 0, shade: 0});
  arr.push({x: 12, y: 0, shade: 0});
  arr.push({x: 13, y: 0, shade: 0});
  arr.push({x: 14, y: 0, shade: 0});
  arr.push({x: 15, y: 0, shade: 0});
  arr.push({x: 16, y: 0, shade: 0});

  arr.push({x: 0, y: 1, shade: 0});
  arr.push({x: 1, y: 1, shade: 1});
  arr.push({x: 2, y: 1, shade: 1});
  arr.push({x: 3, y: 1, shade: 1});
  arr.push({x: 4, y: 1, shade: 0});
  arr.push({x: 5, y: 1, shade: 0});
  arr.push({x: 6, y: 1, shade: 1});
  arr.push({x: 7, y: 1, shade: 0});
  arr.push({x: 8, y: 1, shade: 0});
  arr.push({x: 9, y: 1, shade: 0});
  arr.push({x: 10, y: 1, shade: 1});
  arr.push({x: 11, y: 1, shade: 0});
  arr.push({x: 12, y: 1, shade: 1});
  arr.push({x: 13, y: 1, shade: 1});
  arr.push({x: 14, y: 1, shade: 1});
  arr.push({x: 15, y: 1, shade: 1});
  arr.push({x: 16, y: 1, shade: 0});

  arr.push({x: 0, y: 2, shade: 0});
  arr.push({x: 1, y: 2, shade: 1});
  arr.push({x: 2, y: 2, shade: 0});
  arr.push({x: 3, y: 2, shade: 0});
  arr.push({x: 4, y: 2, shade: 1});
  arr.push({x: 5, y: 2, shade: 0});
  arr.push({x: 6, y: 2, shade: 1});
  arr.push({x: 7, y: 2, shade: 0});
  arr.push({x: 8, y: 2, shade: 0});
  arr.push({x: 9, y: 2, shade: 0});
  arr.push({x: 10, y: 2, shade: 1});
  arr.push({x: 11, y: 2, shade: 0});
  arr.push({x: 12, y: 2, shade: 1});
  arr.push({x: 13, y: 2, shade: 0});
  arr.push({x: 14, y: 2, shade: 0});
  arr.push({x: 15, y: 2, shade: 0});
  arr.push({x: 16, y: 2, shade: 0});

  arr.push({x: 0, y: 3, shade: 0});
  arr.push({x: 1, y: 3, shade: 1});
  arr.push({x: 2, y: 3, shade: 0});
  arr.push({x: 3, y: 3, shade: 0});
  arr.push({x: 4, y: 3, shade: 1});
  arr.push({x: 5, y: 3, shade: 0});
  arr.push({x: 6, y: 3, shade: 1});
  arr.push({x: 7, y: 3, shade: 0});
  arr.push({x: 8, y: 3, shade: 0});
  arr.push({x: 9, y: 3, shade: 0});
  arr.push({x: 10, y: 3, shade: 1});
  arr.push({x: 11, y: 3, shade: 0});
  arr.push({x: 12, y: 3, shade: 1});
  arr.push({x: 13, y: 3, shade: 1});
  arr.push({x: 14, y: 3, shade: 1});
  arr.push({x: 15, y: 3, shade: 1});
  arr.push({x: 16, y: 3, shade: 0});

  arr.push({x: 0, y: 4, shade: 0});
  arr.push({x: 1, y: 4, shade: 1});
  arr.push({x: 2, y: 4, shade: 0});
  arr.push({x: 3, y: 4, shade: 0});
  arr.push({x: 4, y: 4, shade: 1});
  arr.push({x: 5, y: 4, shade: 0});
  arr.push({x: 6, y: 4, shade: 0});
  arr.push({x: 7, y: 4, shade: 1});
  arr.push({x: 8, y: 4, shade: 0});
  arr.push({x: 9, y: 4, shade: 1});
  arr.push({x: 10, y: 4, shade: 0});
  arr.push({x: 11, y: 4, shade: 0});
  arr.push({x: 12, y: 4, shade: 0});
  arr.push({x: 13, y: 4, shade: 0});
  arr.push({x: 14, y: 4, shade: 0});
  arr.push({x: 15, y: 4, shade: 1});
  arr.push({x: 16, y: 4, shade: 0});

  arr.push({x: 0, y: 5, shade: 0});
  arr.push({x: 1, y: 5, shade: 1});
  arr.push({x: 2, y: 5, shade: 1});
  arr.push({x: 3, y: 5, shade: 1});
  arr.push({x: 4, y: 5, shade: 0});
  arr.push({x: 5, y: 5, shade: 0});
  arr.push({x: 6, y: 5, shade: 0});
  arr.push({x: 7, y: 5, shade: 0});
  arr.push({x: 8, y: 5, shade: 1});
  arr.push({x: 9, y: 5, shade: 0});
  arr.push({x: 10, y: 5, shade: 0});
  arr.push({x: 11, y: 5, shade: 0});
  arr.push({x: 12, y: 5, shade: 1});
  arr.push({x: 13, y: 5, shade: 1});
  arr.push({x: 14, y: 5, shade: 1});
  arr.push({x: 15, y: 5, shade: 1});
  arr.push({x: 16, y: 5, shade: 0});

  arr.push({x: 0, y: 6, shade: 0});
  arr.push({x: 1, y: 6, shade: 0});
  arr.push({x: 2, y: 6, shade: 0});
  arr.push({x: 3, y: 6, shade: 0});
  arr.push({x: 4, y: 6, shade: 0});
  arr.push({x: 5, y: 6, shade: 0});
  arr.push({x: 6, y: 6, shade: 0});
  arr.push({x: 7, y: 6, shade: 0});
  arr.push({x: 8, y: 6, shade: 0});
  arr.push({x: 9, y: 6, shade: 0});
  arr.push({x: 10, y: 6, shade: 0});
  arr.push({x: 11, y: 6, shade: 0});
  arr.push({x: 12, y: 6, shade: 0});
  arr.push({x: 13, y: 6, shade: 0});
  arr.push({x: 14, y: 6, shade: 0});
  arr.push({x: 15, y: 6, shade: 0});
  arr.push({x: 16, y: 6, shade: 0});

  arr.push({x: 0, y: 7, shade: 0});
  arr.push({x: 1, y: 7, shade: 1});
  arr.push({x: 2, y: 7, shade: 1});
  arr.push({x: 3, y: 7, shade: 1});
  arr.push({x: 4, y: 7, shade: 1});
  arr.push({x: 5, y: 7, shade: 0});
  arr.push({x: 6, y: 7, shade: 1});
  arr.push({x: 7, y: 7, shade: 0});
  arr.push({x: 8, y: 7, shade: 0});
  arr.push({x: 9, y: 7, shade: 0});
  arr.push({x: 10, y: 7, shade: 1});
  arr.push({x: 11, y: 7, shade: 0});
  arr.push({x: 12, y: 7, shade: 1});
  arr.push({x: 13, y: 7, shade: 1});
  arr.push({x: 14, y: 7, shade: 1});
  arr.push({x: 15, y: 7, shade: 0});
  arr.push({x: 16, y: 7, shade: 0});

  arr.push({x: 0, y: 8, shade: 0});
  arr.push({x: 1, y: 8, shade: 1});
  arr.push({x: 2, y: 8, shade: 0});
  arr.push({x: 3, y: 8, shade: 0});
  arr.push({x: 4, y: 8, shade: 0});
  arr.push({x: 5, y: 8, shade: 0});
  arr.push({x: 6, y: 8, shade: 1});
  arr.push({x: 7, y: 8, shade: 1});
  arr.push({x: 8, y: 8, shade: 0});
  arr.push({x: 9, y: 8, shade: 0});
  arr.push({x: 10, y: 8, shade: 1});
  arr.push({x: 11, y: 8, shade: 0});
  arr.push({x: 12, y: 8, shade: 1});
  arr.push({x: 13, y: 8, shade: 0});
  arr.push({x: 14, y: 8, shade: 0});
  arr.push({x: 15, y: 8, shade: 1});
  arr.push({x: 16, y: 8, shade: 0});

  arr.push({x: 0, y: 9, shade: 0});
  arr.push({x: 1, y: 9, shade: 1});
  arr.push({x: 2, y: 9, shade: 0});
  arr.push({x: 3, y: 9, shade: 1});
  arr.push({x: 4, y: 9, shade: 1});
  arr.push({x: 5, y: 9, shade: 0});
  arr.push({x: 6, y: 9, shade: 1});
  arr.push({x: 7, y: 9, shade: 0});
  arr.push({x: 8, y: 9, shade: 1});
  arr.push({x: 9, y: 9, shade: 0});
  arr.push({x: 10, y: 9, shade: 1});
  arr.push({x: 11, y: 9, shade: 0});
  arr.push({x: 12, y: 9, shade: 1});
  arr.push({x: 13, y: 9, shade: 1});
  arr.push({x: 14, y: 9, shade: 1});
  arr.push({x: 15, y: 9, shade: 1});
  arr.push({x: 16, y: 9, shade: 0});

  arr.push({x: 0, y: 10, shade: 0});
  arr.push({x: 1, y: 10, shade: 1});
  arr.push({x: 2, y: 10, shade: 0});
  arr.push({x: 3, y: 10, shade: 0});
  arr.push({x: 4, y: 10, shade: 1});
  arr.push({x: 5, y: 10, shade: 0});
  arr.push({x: 6, y: 10, shade: 1});
  arr.push({x: 7, y: 10, shade: 0});
  arr.push({x: 8, y: 10, shade: 0});
  arr.push({x: 9, y: 10, shade: 1});
  arr.push({x: 10, y: 10, shade: 1});
  arr.push({x: 11, y: 10, shade: 0});
  arr.push({x: 12, y: 10, shade: 1});
  arr.push({x: 13, y: 10, shade: 0});
  arr.push({x: 14, y: 10, shade: 1});
  arr.push({x: 15, y: 10, shade: 0});
  arr.push({x: 16, y: 10, shade: 0});

  arr.push({x: 0, y: 11, shade: 0});
  arr.push({x: 1, y: 11, shade: 1});
  arr.push({x: 2, y: 11, shade: 1});
  arr.push({x: 3, y: 11, shade: 1});
  arr.push({x: 4, y: 11, shade: 1});
  arr.push({x: 5, y: 11, shade: 0});
  arr.push({x: 6, y: 11, shade: 1});
  arr.push({x: 7, y: 11, shade: 0});
  arr.push({x: 8, y: 11, shade: 0});
  arr.push({x: 9, y: 11, shade: 0});
  arr.push({x: 10, y: 11, shade: 1});
  arr.push({x: 11, y: 11, shade: 0});
  arr.push({x: 12, y: 11, shade: 1});
  arr.push({x: 13, y: 11, shade: 0});
  arr.push({x: 14, y: 11, shade: 0});
  arr.push({x: 15, y: 11, shade: 1});
  arr.push({x: 16, y: 11, shade: 0});

  arr.push({x: 0, y: 12, shade: 0});
  arr.push({x: 1, y: 12, shade: 0});
  arr.push({x: 2, y: 12, shade: 0});
  arr.push({x: 3, y: 12, shade: 0});
  arr.push({x: 4, y: 12, shade: 0});
  arr.push({x: 5, y: 12, shade: 0});
  arr.push({x: 6, y: 12, shade: 0});
  arr.push({x: 7, y: 12, shade: 0});
  arr.push({x: 8, y: 12, shade: 0});
  arr.push({x: 9, y: 12, shade: 0});
  arr.push({x: 10, y: 12, shade: 0});
  arr.push({x: 11, y: 12, shade: 0});
  arr.push({x: 12, y: 12, shade: 0});
  arr.push({x: 13, y: 12, shade: 0});
  arr.push({x: 14, y: 12, shade: 0});
  arr.push({x: 15, y: 12, shade: 0});
  arr.push({x: 16, y: 12, shade: 0});
  return arr;
}
