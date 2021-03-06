"use strict";

var dateFormat = require('dateformat');

const COMMENT_INTRO = `<!--
    This comment and the below content is programatically generated.`;
const COMMENT_BODY = `    You may add a comma-separated list of anchors you'd like a
    direct link to below (e.g. #idl-serializers, #idl-sequence):`;
const COMMENT_OUTRO = `    Don't remove this comment or modify anything below this line.
    If you don't want a preview generated for this pull request,
    just replace the whole of this comment's content by "no preview"
    and remove what's below.
-->`;

let shorten = (txt, size) => {
    txt = txt.split("\n")[0];
    if (size < txt.length) {
        return txt.substr(0, size).trim() + "…";
    }
    return txt;
};

class ViewComment {
    constructor() {
    }
    
    render(pr) {
        let body = pr.body.split(COMMENT_INTRO)[0].trim();
        return `${body}


${ COMMENT_INTRO }
${ COMMENT_BODY }
${ this.getAnchors(pr).join(", ") }
${ COMMENT_OUTRO }
***
${ this.content(pr) }`;
    }
    
    getDate(date) {
        date = dateFormat(date, "UTC:mmm d, yyyy, h:MM TT");
        return `Last updated on ${ date } GMT`;
    }
    
    getAnchors(pr) {
        let a = pr.body.split(COMMENT_BODY);
        if (a.length < 2) return [];
        return a[1].split(COMMENT_OUTRO)[0].trim().split(/,\s*/)
            .filter(a => !(/^\s*$/).test(a))
            .map(a => "#" + a.trim().replace("#", ""));
    }
    
    content(pr) {
        let anchors = this.getAnchors(pr);
        let anchor = anchors.length == 1 ? anchors[0] : "";
        let size = Math.floor(40 / anchors.length);

        if (pr.isMultipage) {
            return pr.preview_files.map(f => {
                let title = this.getDate(new Date()) + ` (${ f.head.short_sha })`;
                let preview = this.displayLink(`/${f.head.filename}`, f.head.cache_url + anchor, title);
                let diff = this.displayLink("diff", f.diff.cache_url, title);
                return `${ preview } ${ this.displayAnchors(f.head.cache_url, anchors, size) } ( ${ diff } )`;
            }).join("\n");
        }

        let f = pr.preview_files[0];
        let title = this.getDate(new Date()) + ` (${ f.head.short_sha })`;
        let preview = this.displayLink("Preview", f.head.cache_url + anchor, title);
        let diff = this.displayLink("Diff", f.diff.cache_url, title);
        return `${ preview } ${ this.displayAnchors(f.head.cache_url, anchors, size) }| ${ diff }`;
    }
    
    displayLink(content, href, title) {
        return `<a href="${ href }" title="${title}">${ content }</a>`;
    }

    displayAnchors(url, anchors, size) {
        if (!anchors || anchors.length < 2) return "";
        if (typeof size == "number") {
          size = Math.floor(size);
          if (size < 3) {
            size = null;
          }
        }
        return anchors.map(a => `(<a href="${ url }${ a }" title="${ a }">${ size ? shorten(a, size) : "#" }</a>)`).join(" ") + " ";
    }
}

module.exports = ViewComment;