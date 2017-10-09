var fs = require("fs");
var request = require("request");
var cheerio = require("cheerio");
var phantom = require("phantom");

var url = "http://www.investopedia.com/walkthrough/corporate-finance/";
var _ph, _page;

phantom.create().then(function(ph){
    _ph = ph;
    return _ph.createPage();
}).then(function(page){
    _page = page;
    return _page.open(url);
}).then(function(status){
    console.log(status);
    return _page.evaluate(function() {
        var $chapters = $(".tab_panel.tabcontent");
        var oDoc = {table: []};

        var root = "http://www.investopedia.com";

        for (var i = 0; i < $chapters.length; i++) {
            var index = i + 1;
            var oChapter = {
                title: "Chapter " + index,
                subChapters: []
            };
            var $subChapters = $(".tab_panel.tabcontent:eq("+i+") .tab-menu.menuleft ol li");
            console.log($subChapters.text());
            for (var j = 0; j < $subChapters.length; j++) {
                var oSubChapter = {
                    title: $subChapters.eq(j).text(),
                    subChapters: []
                };

                var sChapterPattern = oSubChapter.title.split(" ")[0];

                var $subsubChapters = $(".tab_panel.tabcontent:eq("+i+") .tab-menu.menuright ol li");
                for (var u = 0; u < $subsubChapters.length; u++) {
                    var href = $subsubChapters.eq(u).find("a").attr("href");
                    var sTitle = $subsubChapters.eq(u).text();
                    if (sTitle.indexOf(sChapterPattern) === 0) {
                        oSubChapter.subChapters.push({
                            title: sTitle,
                            link: root + href
                        });
                    }
                }

                oChapter.subChapters.push(oSubChapter);
            }
            oDoc.table.push(oChapter);
        }
        return oDoc;
    });
}).then(function(oDoc){
    _page.close();
    _ph.exit();
    var indexHtml = "";
    var promises = [];
    var indexes = [];
    for (var i = 0; i < oDoc.table.length; i++) {
        var subChapterhtml = "";
        for (var j = 0; j < oDoc.table[i].subChapters.length; j++) {
            var subsubChapterhtml = "";
            for (var u = 0; u < oDoc.table[i].subChapters[j].subChapters.length; u++) {
                var url = oDoc.table[i].subChapters[j].subChapters[u].link;
                var title = oDoc.table[i].subChapters[j].subChapters[u].title;
                subsubChapterhtml = subsubChapterhtml + "<li><a href=#" + title.split(" ")[0] + ">" + title +"</a></li>";
                indexes.push(title.split(" ")[0]+".html");
                promises.push(fetchContent(url, title));
            }
            subChapterhtml = subChapterhtml + "<li>" + oDoc.table[i].subChapters[j].title + "<ul>" + subsubChapterhtml + "</ul></li>";
        }
        indexHtml = indexHtml + "<li>" + oDoc.table[i].title + "<ul>" + subChapterhtml + "</ul></li>";
    }

    indexHtml = "<style>.textstrong {font-weight: bold;}</style><a name='table'><h2>Table of Content</h2></a>" + indexHtml;

    return Promise.all(promises).then(function() {
        fs.writeFile("index.html", indexHtml, (err) => {
            fillContent(indexes);
        })
    });
}).catch((err) =>{
   console.log(`sth goes wrong $err}`);
});

process.on("uncaughtException", (err) => {
    console.log(`caught exception: ${err} \n`);
});

function fillContent(indexes) {
    if (indexes.length > 0) {
        var readStream = fs.createReadStream(indexes[0]);
        var writeStream = fs.createWriteStream("index.html", {"flags":"a"});
        readStream.pipe(writeStream).on("finish", ()=> {
            indexes.splice(0, 1);
            fillContent(indexes);
        });
    }
}

function fetchContent(url, title) {
    return new Promise(function(resolve, reject) {
        request(url, function(error, response, html) {
            console.log("fetch content from: " + url);
            var $ = cheerio.load(html);
            $("a.next-pg").remove();
            $("a").removeAttr("href");
            $("a").addClass("textstrong");
            $(".BC-Textnote").remove();
            $("script").remove();
            var sPrepend = "<a name=" + title.split(" ")[0] + "></a><h2>" + title + "</h2> <a href='#table'>Table of Content</a>" + $(".content-box.clear");
            fs.writeFile(title.split(" ")[0]+".html", sPrepend);
            resolve();
        });
    });
}
