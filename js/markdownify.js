(function(document) {

    var interval,
        defaultReloadFreq = 3,
        previousText,
        storage = chrome.storage.local;

    function getExtension(url) {
        url = url.substr(1 + url.lastIndexOf("/"))
            .split('?')[0]
            .split('#')[0];
        return url.substr(1 + url.lastIndexOf("."))
    }

    // Onload, take the DOM of the page, get the markdown formatted text out and
    // apply the converter.
    function makeHtml(data) {
        storage.get('mathjax', function(items) {
            // Convert MarkDown to HTML without MathJax typesetting.
            // This is done to make page responsiveness.  The HTML body
            // is replaced after MathJax typesetting.
            marked.setOptions(config.markedOptions);
            var html = marked(data);
            $(document.body).html(html);

            // Apply MathJax typesetting
            if (items.mathjax) {
                var markedJs = $('<script/>').attr('type', 'text/javascript')
                    .attr('src', chrome.extension.getURL('js/marked.js'));
                $(document.head).append(markedJs);

                var highlightJs = $('<script/>').attr('type', 'text/javascript')
                    .attr('src', chrome.extension.getURL('js/highlight.js'));
                $(document.head).append(highlightJs);

                var configJs = $('<script/>').attr('type', 'text/javascript')
                    .attr('src', chrome.extension.getURL('js/config.js'));
                $(document.head).append(configJs);

                // Inject js required to process MathJax before Markdown
                var js = $('<script/>').attr('type', 'text/javascript')
                    .attr('src', chrome.extension.getURL('js/runMathJax.js'));
                $(document.head).append(js);

                // Create hidden div to use for MathJax processing
                var mathjaxDiv = document.createElement("div");
                mathjaxDiv.setAttribute("id",
                                        config.mathjaxProcessingElementId);
                $(mathjaxDiv).text(data);
                mathjaxDiv.style.display = 'none';
                document.body.appendChild(mathjaxDiv);
            }
        });
    }

    function getThemeCss(theme) {
        return chrome.extension.getURL('theme/' + theme + '.css');
    }

    function setTheme(theme) {
        var defaultThemes = ['Clearness', 'ClearnessDark', 'Github', 'TopMarks'];

        if($.inArray(theme, defaultThemes) != -1) {
            var link = $('#theme');
            $('#custom-theme').remove();
            if(!link.length) {
                var ss = document.createElement('link');
                ss.rel = 'stylesheet';
                ss.id = 'theme';
                //ss.media = "print";
                ss.href = getThemeCss(theme);
                document.head.appendChild(ss);
            } else {
                link.attr('href', getThemeCss(theme));
            }
        } else {
            var themePrefix = 'theme_',
                key = themePrefix + theme;
            storage.get(key, function(items) {
                if(items[key]) {
                    $('#theme').remove();
                    var theme = $('#custom-theme');
                    if(!theme.length) {
                        var style = $('<style/>').attr('id', 'custom-theme')
                                        .html(items[key]);
                        $(document.head).append(style);
                    } else {
                        theme.html(items[key]);
                    }
                }
            });
        }
    }

    function setMathJax() {
        storage.get('enable_latex_delimiters', function(items) {

            // Enable MathJAX LaTeX delimiters
            if (items.enable_latex_delimiters) {
                config.enableLatexDelimiters();
            }

            // Add MathJax configuration and js to document head
            var js = $('<script/>').attr('type','text/javascript')
                .attr('src', 'https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML');
            $(document.head).append(js);

            var mjc = $('<script/>').attr('type', 'text/x-mathjax-config').
                html("MathJax.Hub.Config(" +
                     JSON.stringify(config.mathjaxConfig) +
                     ");");
            $(document.head).append(mjc);
        });
    }

    function stopAutoReload() {
        clearInterval(interval);
    }

    function startAutoReload() {
        stopAutoReload();

        var freq = defaultReloadFreq;
        storage.get('reload_freq', function(items) {
            if(items.reload_freq) {
                freq = items.reload_freq;
            }
        });

        interval = setInterval(function() {
            $.ajax({
                url: location.href,
                cache: false,
                success: function(data) {
                    if (previousText == data) {
                        return;
                    }
                    makeHtml(data);
                    previousText = data;
                }
            });
        }, freq * 1000);
    }

    function render() {
        $.ajax({
            url: location.href,
            cache: false,
            complete: function(xhr, textStatus) {
                var contentType = xhr.getResponseHeader('Content-Type');
                if(contentType && (contentType.indexOf('html') > -1)) {
                    return;
                }

                makeHtml(document.body.innerText);
                var specialThemePrefix = 'special_',
                    pageKey = specialThemePrefix + location.href;
                storage.get(['theme', pageKey], function(items) {
                    theme = items.theme ? items.theme : 'Clearness';
                    if(items[pageKey]) {
                        theme = items[pageKey];
                    }
                    setTheme(theme);
                });

                storage.get('auto_reload', function(items) {
                    if(items.auto_reload) {
                        startAutoReload();
                    }
                });
            }
        });
    }

    storage.get(['exclude_exts', 'disable_markdown', 'mathjax'], function(items) {
        if(items.disable_markdown) {
            return;
        }

        if(items.mathjax) {
            setMathJax();
        }

        var exts = items.exclude_exts;
        if(!exts) {
            render();
            return;
        }

        var fileExt = getExtension(location.href);
        if (typeof exts[fileExt] == "undefined") {
            render();
        }
    });

    chrome.storage.onChanged.addListener(function(changes, namespace) {
        var specialThemePrefix = 'special_',
            pageKey = specialThemePrefix + location.href;
        for (key in changes) {
            var value = changes[key];
            if(key == pageKey) {
                setTheme(value.newValue);
            } else if(key == 'theme') {
                storage.get(pageKey, function(items) {
                    if(!items[pageKey]) {
                        setTheme(value.newValue);
                    }
                });
            } else if(key == 'reload_freq') {
                storage.get('auto_reload', function(items) {
                    startAutoReload();
                });
            } else if(key == 'auto_reload') {
                if(value.newValue) {
                    startAutoReload();
                } else {
                    stopAutoReload();
                }
            } else if(key == 'disable_markdown') {
                location.reload();
            }
        }
    });

}(document));
