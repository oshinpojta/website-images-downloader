const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

//let URL = "https://en.wikipedia.org/wiki/Main_Page";
let URL = "https://www.growpital.com";
let URL_HOST = URL;

if(URL_HOST.startsWith('https://')){
    URL_HOST = URL_HOST.split('/')[2];
}else{
    URL_HOST = URL_HOST.split('/')[0];
}


(async function getURLSinPage(){
    try {
        let hostname = URL; 
        if(hostname.startsWith('https://')){  // Setting Up Host-Name if url starts with 'https://' then split it with '/' 
            hostname = hostname.split('/')[2];  //and return the domain name placed in array at index 2. 
        }else{
            hostname = hostname.split('/')[0];  // else return the domain name placed in array at index 0,
        } 
        
        let addresses = await new Promise((resolve, reject) => {               // creating a new promise since the resolve dns is going to be synchronous and but uses a callback.
                                    dns.resolve4(hostname, async (err, addresses)=>{
                                        if(err){
                                            console.log(err);
                                            resolve([]);           // if err, resolve empty array but don't halt the execution 
                                        }else{
                                            resolve(addresses);    //resolve addresses 
                                        }
                                    })
                                });

        
        let response = await axios.get(URL);       // get html response using axios
        let html = response.data;                  // store html data in html variable
        let $ = cheerio.load(html);                // using cheerio to parse html and make a cheerio object that can be used to get html elements

        let linksList = $('a');               // get all html elements with 'a' tag since it holds all the links
        let linksArr = [];      
        let linkSet = new Set();                 //declared a set to keep links distinct.
        for(let i=0;i<linksList.length;i++){
            let link = linksList[i].attribs.href;   //for 'i'th element 'a', get it attribbutes 'href' property which holds the link of other web-pages. 
            if(link){
                linkSet.add(link);      //if link not null or undefined, add it to the set.
            }
        }
        linksArr = [URL, ...linkSet];  // spread operator to  insert URL and other links from where we can download images.
        console.log(linksArr);

        let downloadUrls = [];
        for(let i=0;i<linksArr.length;i++){
                                            // checking if there are some links like '/static/about.html' where domain name needs to be inserted
            let linkURL = linksArr[i];
            if(linkURL.startsWith('/')){
                linkURL = `https://${URL_HOST}${linkURL}`;   //inserting host or dimain if a link starts with '/'
            }
            let linkHostname = linkURL;
            //console.log(linkHostname.split('/'));
            if(linkHostname.startsWith('https://')){
                linkHostname = linkHostname.split('/')[2];
            }else{
                linkHostname = linkHostname.split('/')[0];
            }
            
            let addresses2 = await new Promise((resolve, reject) => {          // resolving the addresses of all the urls that are grabbed from the website, 
                                dns.resolve4(linkHostname, (err, addresses2) => {         //so these addresses will be checked for match with the main websites if they have the same domain or not
                                    if (err) {
                                        console.log(err);
                                        resolve([]);
                                    }else{
                                        resolve(addresses2);
                                    }
                                });
                            });

           
            let check = false;                        
            for(let i=0;i<addresses2.length;i++){    // checking here if any urls includes the ip-addresses of the main one and then pushed to the downloading URLs array
                if(addresses.includes(addresses2[i])){ // if TRUE, means one of the IP Address of Domain matches the domains of this link ( to download images only from URL's domain )
                    check = true; 
                    break;
                }
            }
            if(check){
                downloadUrls.push(linkURL);
            }
        }

        for(let i=0;i<downloadUrls.length;i++){     // all the verified URLs with current domain are used to get their HTML and pass it on to get images link from every web-page
            console.log(downloadUrls[i]);
            let response = await axios.get(downloadUrls[i]);  
            let html = response.data;   //get html from response.data for every url
            let $ = cheerio.load(html);
            let isDownloaded = await getImageLink($);      //passing it to the getImageLink() to grab all the images link and download them 
            console.log(`Downloaded Images From Link - ${downloadUrls[i]}, isDownloaded :- `, isDownloaded);
        }
        

    } catch (error) {
        console.log("Get URL Page Function ERROR");
        console.log(error);
    }

})()

async function getImageLink($){
    try {
        let imgTagList = $('img');      //grabbing 'img' tag from cheerio HTML object
        let imgLinkArr = [];
        let imgSet = new Set();         //using set to keep the links unique
        for(let i=0;i<imgTagList.length;i++){
            let imgLink = imgTagList[i].attribs.src;    // grabbing 'src' attribute of img-tag
            if(imgLink){
                imgSet.add(imgLink);    //if image-link not null or undefined, add it to the set
            }
        }
        imgLinkArr = [...imgSet];
        for(let i=0;i<imgLinkArr.length;i++){
            let imglink = imgLinkArr[i];

            //verifying if the img link ends with these extensions, if not it might be using a query, then split it using '?' and return index-[0] of the array
            if(!imglink.endsWith('.jpg') || !imglink.endsWith('.png') || !imglink.endsWith('.jpeg') || !imglink.endsWith('.svg') || !imglink.endsWith('.ico') || !imglink.endsWith('.bmp') ){
                imglink = imglink.split('?')[0];    
            }
            let r = await downloadImage(imglink); //passing image downloading link to downloadImage()
            console.log("Image Downloaded @ ", r);
        }

        return new Promise((resolve, reject) => {
            resolve(true);
        })
        
    } catch (error) {
        console.log('Get Image Link Function Error')
        console.log(error);
        return new Promise((resolve, reject) => {  // resolve false if error, but don't halt the execution of the program
            resolve(false);
        })
    }
};

async function downloadImage(url){
    try{
        if(url.startsWith('/')){  //if img link starts with '/' then add https else download it as it is. (required for situations like in wikipedia where img-links -> //upload/static/..)
            url = `https:${url}`;
        }
        console.log(url);
        let urlArray = url.split('/');
        let imagesDir = path.join(__dirname,'images'); //set a path for images folder
        if(!fs.existsSync(imagesDir)){  // create folder if not exists
            fs.mkdirSync(imagesDir);
        }
        let hostname = URL_HOST;

        let websiteDir = path.join(imagesDir,`${hostname}`); //set a path for current host name and make a folder as hostname to download images in it
        if(!fs.existsSync(websiteDir)){                     // create folder if not exists
            fs.mkdirSync(websiteDir);
        }
        let fileName = urlArray[urlArray.length-1];        //get last name of the images by using split in img-link and that is its filename
        let filepath = path.join(websiteDir,`${fileName}`);     //creating file path, by appending website's directory path and image's name
        let downloadResponse = await axios({    // getting download respons in binary data
            url : url,
            method : 'GET',
            responseType : 'stream'
        });
        return new Promise((resolve, reject) => {   //creating a promise to let the calling function wait for its download before executing next one
            downloadResponse.data.pipe(fs.createWriteStream(filepath, { flags : 'w+'})) //creating a writeStream to write image to a file and return resolved response with filepath 
                .on('error', reject)
                .once('close',() => resolve(filepath))
        }) ;

    }catch(error){
        console.log("Download Image Function Error")
        console.log(error);
        return new Promise((resolve, reject) => {
            resolve(null);      //if error resolve null instead of filepath
        }) ;
    }
    
}

