// settings
var timeBetweenImagePlacementAdd = 15;
var timeBetweenImagePlacementRemove = 10;
var timeDelayAfterAddingImages = 7 * 1000;
var timeToShowRecentImage = 7 * 1000;
var timeToShowMainImage = 1 * 1000; // plus time it takes to load all images
var timeToPauseAfterFadingIn = 1 * 1000;
var timeToPauseAfterFadingOut = 1.5 * 1000;
var imageHeight = 100;
var imageWidth = 100;
var fadeSpeed = 0.015;
var mainImage = "devsigner-background2.png";
var jsonFiles = ["devsigner/devsigner.json","devsigner/devsignercon.json","devsigner/dvsgnr2016.json"];
var darkPixels = countDarkPixels();
var reuseImages = true;
var showNewPhotos = 5;

// global variables
var canvas;
var ctx;
var recentPhotoIndex = showNewPhotos;
var fileArray = [];

$(document).ready(function() {
  canvas = $(document).find("canvas")[0];
  ctx = canvas.getContext("2d");
  flow('start');
});

function flow(step) {
  switch (step) {
    case 'start':
      drawMainImage("in");
      break;
    case 'drawMainImage_fadeIn_done':
      loadAllImages();
      break;
    case 'loadAllImages_done':
      drawMainImage("out");
      break;
    case 'drawMainImage_fadeOut_done':
      drawRecentImage();
      break;
    case 'drawRecentImage_done':
      prepareMosaic();
      break;
    case 'drawMosaic_done':
      flow('start');
      break;
  }
}

function loadAllImages() {
  var fileCounterJSON = jsonFiles.length;
  $.each( jsonFiles, function( index, item ) {
    $.getJSON( item, function( data ) {
      var fileCounterImage = data.length;
      $.each( data, function( key, val ) {
        if (val["display_url"]) {
          var photoURL = val["display_url"];
          var photoTakenDate = val["taken_at_timestamp"];
          var photoHeight = val["dimensions"]["height"];
          var photoWidth = val["dimensions"]["width"];
        }
        else if (val["urls"][0]) {
          var photoURL = val["urls"][0];
          var photoTakenDate = val["created_time"];
          var photoHeight = val["images"]["standard_resolution"]["height"];
          var photoWidth = val["images"]["standard_resolution"]["width"];
        }
        else {
          console.log('unknown array structure');
          return true;
        }
        var filePath = "devsigner/" + (photoURL.substr(photoURL.lastIndexOf('/') + 1));
        getImageBrightness(filePath, function(brightness) {
          if (brightness >= 0) {
            fileArray.push({filePath: filePath, brightness: brightness, photoTakenDate: photoTakenDate, photoHeight: photoHeight, photoWidth: photoWidth});
          }
          fileCounterImage--;
          if (fileCounterImage === 0) {
            fileCounterJSON--;
            if (fileCounterJSON === 0) {
              fileArray = removeDuplicatesBy(x => x.filePath, fileArray);
              flow('loadAllImages_done');
              return;
            }
          }
        });
      });
    });
  });
}

function drawMainImage(fadeMode) {
  var img = new Image;
  img.src = mainImage;
  img.onload = function() {
    scaledDimensions = fitImageOn(img);
    if (fadeMode === "in") {
      fadeInOut(img, 0, fadeSpeed, scaledDimensions["xStart"], scaledDimensions["yStart"], scaledDimensions["renderableWidth"], scaledDimensions["renderableHeight"]).then(function(){
          flow('drawMainImage_fadeIn_done');
          return;
      });
    }
    else { //fadeMode === "out"
      setTimeout(function(){
        fadeInOut(img, 1, -fadeSpeed, scaledDimensions["xStart"], scaledDimensions["yStart"], scaledDimensions["renderableWidth"], scaledDimensions["renderableHeight"]).then(function(){
          setTimeout(function(){
            flow('drawMainImage_fadeOut_done');
            return;
          }, timeToPauseAfterFadingOut);
        });
      }, timeToShowMainImage);
    }
  }
}

function drawRecentImage() {
  recentPhotoIndex--;
  if (recentPhotoIndex < 0) {
    recentPhotoIndex = 5;
  }
  fileArray.sort(function(a, b) {
    return b.photoTakenDate - a.photoTakenDate;
  });
  var img = new Image;
  img.src = fileArray[recentPhotoIndex]["filePath"];
  img.onload = function() {
    scaledDimensions = fitImageOn(img);
    fadeInOut(img, 0, fadeSpeed, scaledDimensions["xStart"], scaledDimensions["yStart"], scaledDimensions["renderableWidth"], scaledDimensions["renderableHeight"]).then(function(){
      setTimeout(function(){
        fadeInOut(img, 1, -fadeSpeed, scaledDimensions["xStart"], scaledDimensions["yStart"], scaledDimensions["renderableWidth"], scaledDimensions["renderableHeight"]).then(function(){
          setTimeout(function(){
            flow('drawRecentImage_done');
            return;
          }, timeToPauseAfterFadingOut);
        });
      }, timeToShowRecentImage);
    });
  }
}

function prepareMosaic() {
  fileArray.sort(function(a, b) {
    return a.brightness - b.brightness;
  });
  var imageArrayDark = fileArray.slice(0, darkPixels);
  var imageArrayLight = fileArray.slice(darkPixels);
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
      var coloroffset = {r: 0, g: 0, b: 0};
    }
    else {
      var image = imageArrayDark[0];
      if (imageArrayDark.length > 0) {
        imageArrayDark.splice(0, 1);
      }
      if (reuseImages === true && imageArrayDark.length < 1) {
        imageArrayDark = fileArray.slice(0, Math.floor(Math.floor(fileArray.length)));
      }
      var coloroffset = {r: 30, g: -70, b: 10};
    }
    if (image) {
      imageArray.push({imagePath: image['filePath'], x: val.x, y: val.y, coloroffset: coloroffset, shade: val.shade});
    }
  });
  drawMosaic(imageArray, 'add');
}

function drawMosaic(imageArray, mode) {
  var index = 0;
  var timeDelay = timeToPauseAfterFadingIn;
  var timeBetweenImagePlacement = timeBetweenImagePlacementRemove;
  if (mode == "add") {
    timeBetweenImagePlacement = timeBetweenImagePlacementAdd;
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
          var imageData = ctx.getImageData(val.x * imageWidth, val.y * imageHeight, imageWidth, imageHeight);
          var canvasPixelArray = imageData.data;
          for (var i = 0; i < canvasPixelArray.length; i += 4) {
            var avg = (canvasPixelArray[i] + canvasPixelArray[i + 1] + canvasPixelArray[i + 2]) / 3;
            canvasPixelArray[i]     = avg + val.coloroffset.r; // red
            canvasPixelArray[i + 1] = avg + val.coloroffset.g // green
            canvasPixelArray[i + 2] = avg + val.coloroffset.b; // blue
          }
          ctx.putImageData(imageData, val.x * imageWidth, val.y * imageHeight);
        };
      }
      else { //mode == "remove"
        ctx.clearRect(val.x * imageWidth, val.y * imageHeight, imageWidth, imageHeight);
      }
    }, index * timeBetweenImagePlacement);
  });
  setTimeout(function(){
    if (mode === "add") {
      drawMosaic(imageArray, 'remove');
    }
    else {
      flow('drawMosaic_done');
      return;
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

function getImageBrightness(imageSrc, callback) {
    var img = document.createElement("img");
    var colorSum = 0;
    img.src = imageSrc;
    img.style.display = "none";
    img.onload = function() {

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

function removeDuplicatesBy(keyFn, array) {
  var mySet = new Set();
  return array.filter(function(x) {
    var key = keyFn(x), isNew = !mySet.has(key);
    if (isNew) mySet.add(key);
    return isNew;
  });
}

var fitImageOn = function(imageObj) {
	var imageAspectRatio = imageObj.width / imageObj.height;
	var canvasAspectRatio = canvas.width / canvas.height;
	var renderableHeight, renderableWidth, xStart, yStart;

	// If image's aspect ratio is less than canvas's we fit on height
	// and place the image centrally along width
	if(imageAspectRatio < canvasAspectRatio) {
		renderableHeight = canvas.height;
		renderableWidth = imageObj.width * (renderableHeight / imageObj.height);
		xStart = (canvas.width - renderableWidth) / 2;
		yStart = 0;
	}

	// If image's aspect ratio is greater than canvas's we fit on width
	// and place the image centrally along height
	else if(imageAspectRatio > canvasAspectRatio) {
		renderableWidth = canvas.width
		renderableHeight = imageObj.height * (renderableWidth / imageObj.width);
		xStart = 0;
		yStart = (canvas.height - renderableHeight) / 2;
	}

	// Happy path - keep aspect ratio
	else {
		renderableHeight = canvas.height;
		renderableWidth = canvas.width;
		xStart = 0;
		yStart = 0;
	}
  return {renderableHeight: renderableHeight, renderableWidth: renderableWidth, xStart: xStart, yStart: yStart};
};

function fadeInOut(img, alpha, delta, x, y, width, height) {
  return new Promise(function(resolve,reject){
    function step() {
      alpha += delta;
      if (alpha <= 0 || alpha >= 1) { // last step
        ctx.globalAlpha = 1;
        if (alpha <= 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        else {
          ctx.drawImage(img, x, y, width, height);;
        }
      }
      else {
        ctx.clearRect(x, y, width, height);
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, x, y, width, height);;
      }

      if (alpha > 0 && alpha < 1) {
        requestAnimationFrame(step);
      }
      else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
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
