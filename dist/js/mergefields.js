(function(){

    var KEYS = {
        down : 40,
        up : 38,
        enter : 13,
        escape : 27
    };  

    function extendObj(){ 
        var baseObj = arguments[0];
        for (var i=1; i<arguments.length; i++) {
            for (var x in arguments[i]) {
                baseObj[x] = arguments[i][x];
            }
        }
        return baseObj;
    }

    function IslandBlock (opts) {
        this.options = {};
        extendObj(this.options, /*this._defaultOpts,*/ opts || {});
        
        if (!this.options.fullPattern) {
            throw "fullPattern must be set in the options"
        }
    }
   
    IslandBlock.prototype = {
    
        /** Triggered by the framework when extension is initialized 
        * @param {Element} The editor instance
        */            
        init : function (editor) {
            editor.subscribe("editableKeypress", this._handleKeyPress.bind(this));
            editor.subscribe("editableKeydown", this._handleKeyDown.bind(this));
        },
          
        _lastTextNode : null,
        
        /** Triggered by the editableKeyup event, listens to key presses and gets the current text users has entered and initializes the checks for pattern matching 
        * @param {Event} DOM Keypress event
        * @param {Element} The editor instance
        */                        
        _handleKeyPress : function (evt, editor) {
            var keyCode = evt.keyCode; 
            var charTyped = String.fromCharCode(keyCode);                
            var sel, word = "";
            if (window.getSelection && (sel = window.getSelection()).modify) {
                var selectedRange = sel.getRangeAt(0);
                sel.collapseToStart();
                //sel.modify("move", "backward", "word");
                sel.modify("move", "backward", "line");
                sel.modify("extend", "forward", "line");

                this._lastTextNode = sel.toString() + charTyped;

                // Restore selection
                sel.removeAllRanges();
                sel.addRange(selectedRange);
            }
                          
            if (this._lastTextNode) {
                this._checkForMatches();
            }
                        
        },

        /** */
        _handleKeyDown : function (evt, editor) { 

            var keyCode = evt.keyCode;
            if (this._isMenuOpen && keyCode===KEYS.enter) { 
                evt.preventDefault();
                evt.stopPropagation();
                this._selectMenuSelectionWithEnter();
            } else if (this._isMenuOpen && (keyCode===KEYS.up || keyCode===KEYS.down)){ 
                evt.preventDefault();
                this._moveMenuSelection(keyCode===KEYS.up);
            } else if (this._isMenuOpen && keyCode===KEYS.escape){ 
                evt.preventDefault();
                this._lastTextNode = null;
                this._hideMenu();
            }

            
        },
        
        
        /** Looks at the text entered by the user and sees if it matches either the full or partial pattern. 
        * @param {element} The parent element that contains the cursor.
        */
        _checkForMatches : function (editor) {            
            var parElement = this.base.getSelectedParentElement(),
                partialMatch,
                txt = this._lastTextNode; 
            if (this.options.fullPattern.exec(txt)) {
                this._wrap(parElement);
                this._hideMenu();
            } else if (this.options.startPattern && (partialMatch = this.options.startPattern.exec(txt))) {
                this._showHintMenu(parElement, partialMatch);
            } else {
                this._hideMenu();
            }            
        },
        
        /* This function takes the phrase that matches the regular expression pattern and replaces it with the wrapper element 
        * @param {Element} The parent element that the cursor is in. 
        * @param {Boolean} Flag that says that we should use the start regular expression to find a match instead of the full pattern. (Used by selection menu)
        * @param {String} When partial match is given, this value is used to replace the text in the partial match so we have full text. This requires isPartial to be set.             
        */
        _wrap : function (elem, isPartial, full_txt) {
            var childNodes = elem.childNodes;
            for (var i=0; i<childNodes.length; i++) {
                var child = childNodes[i];
                var pattern = isPartial ? this.options.startPattern : this.options.fullPattern;
                var match = pattern.exec(child.nodeValue);
                if (child.nodeType === 3 && match){
                    if (isPartial) {
                        child.nodeValue = child.nodeValue.replace(this.options.startPattern, "[" + full_txt + "]");
                    } else if (this.options.replacements && this.options.replacements.indexOf(match[1].toLowerCase())===-1){
                        return;
                    }
                    txt = child.nodeValue.replace(this.options.fullPattern, this.options.replacementTemplate);
                    var tempDiv = document.createElement("div");
                    tempDiv.innerHTML = txt;
                    var tempDivChildren = tempDiv.childNodes;
                    while (tempDivChildren.length) {  //live node set so when you append to different element it is removed from this one
                        elem.insertBefore(tempDivChildren[0], child);
                    }
                    elem.removeChild(child);
                    break;
                }
            }
        },
        
        /** Triggered when the selection menu needs to be added to the page. Calls methods to get position, create menu, and sets the location. */
        _showHintMenu: function(elem, partialMatch) {
        
            var partialText = partialMatch[1];
            this.base.saveSelection(); 
            
            var curPos = this.getXYPosition();
            /* TODO Right now I am just destroying and recreating it - this is bad */
            if(this.menu){
                this._hideMenu();
            }
            this._createMenu(partialText);
            if (this.menu) {
                this.menu.style.display = "block";
                this.menu.style.top = (curPos.y + curPos.h) + "px";
                this.menu.style.left = curPos.x + "px";
                this._isMenuOpen = true;
            }
            this._lastElem = elem;
        },

        /** Generates the Selection menu with the options the user can choose from. */
        _createMenu : function (partialText) {
            var menuWrapper = document.createElement("div");
            menuWrapper.classList.add("data-island-menu");
            var menu = document.createElement("ul");
            var hasMatches = false;
            
            //hard coding this for now, will need to be set in opts or Ajax call
            var dItems = this.options.replacements;
            dItems.forEach( function(cv) {
               if (cv.indexOf(partialText)>-1) {
                   var li = document.createElement("li");
                   li.innerHTML = "<a>" + cv + "</a>";
                   li.setAttribute("data-text", cv);
                   menu.appendChild(li);
                   hasMatches = true;
               }
            });
            
            if (hasMatches) {
                menuWrapper.appendChild(menu);
                document.body.appendChild(menuWrapper);
                this.menu = menuWrapper;                
                menuWrapper.addEventListener("click", this._handleSectionMenuClick.bind(this) );
            }
        },            

        /** Handles the clicks on the Selection menu. Detects what is clicked and calls the wrap method with the option picked */
        _handleSectionMenuClick : function (evt) {
            var target = evt.target;
            if (target.nodeName==="A") {
                var txt = target.parentNode.getAttribute("data-text");               
                this._wrap(this._lastElem, true, txt);
            }
            this._hideMenu();
            this.base.restoreSelection();
        },
        
        /** Hides menu and removes it from the DOM */
        _hideMenu : function () {
            this._isMenuOpen = false;
            if(this.menu) {
                this.menu.style.display = "none";            
                this.menu.parentNode.removeChild(this.menu);
                this.menu = null;
            }
        },
        
        /**  */
        _moveMenuSelection : function (isUp) {
        
            var selectedElem = this.menu.getElementsByClassName("active");
            var nextElem;
            if (selectedElem.length){
                nextElem = isUp ? selectedElem[0].previousSibling : selectedElem[0].nextSibling;
                selectedElem[0].classList.remove("active");
            } else {
                nextElem = this.menu.getElementsByTagName("li")[0];
            }
            
            if(!nextElem) {
                var lis = this.menu.getElementsByTagName("li");
                nextElem = lis[isUp?lis.length-1:0];
            }
                            
            nextElem.classList.add("active");

        },
        
        /** */
        _selectMenuSelectionWithEnter : function () {
            var selectedElem = this.menu.getElementsByClassName("active");
            if (!selectedElem.length){
                selectedElem = this.menu.getElementsByTagName("li");
            }
            selectedElem[0].childNodes[0].click();
        },
        
        /** Calculates and returns the x,y position and the height of cursor in the contenteditable element
        * @return { {x:Number, y:Number, h: Number}} 
        */
        getXYPosition : function () {
            var win = window;
            var doc = win.document;
            var sel = doc.selection, range, rects, rect;
            var x = 0, y = 0;
            if (sel) { 
                if (sel.type != "Control") {
                    range = sel.createRange();
                    range.collapse(true);
                    x = range.boundingLeft;
                    y = range.boundingTop;
                }
            } else if (win.getSelection) {
                sel = win.getSelection();
                if (sel.rangeCount) {
                    range = sel.getRangeAt(0).cloneRange();
                    if (range.getClientRects) {
                        range.collapse(true);
                        rects = range.getClientRects();
                        if (rects.length > 0) {
                            rect = range.getClientRects()[0];
                        }
                        x = rect ? rect.left : 0;
                        y = rect ? rect.top : 0;
                    }
                    // Fall back to inserting a temporary element
                    if (x == 0 && y == 0) {
                        var span = doc.createElement("span");
                        if (span.getClientRects) {
                            // Ensure span has dimensions and position by
                            // adding a zero-width space character
                            span.appendChild( doc.createTextNode("\u200b") );
                            range.insertNode(span);
                            rect = span.getClientRects()[0];
                            x = rect.left;
                            y = rect.top;
                            var spanParent = span.parentNode;
                            spanParent.removeChild(span);

                            // Glue any broken text nodes back together
                            spanParent.normalize();
                        }
                    }
                }
            }
            return { x: x, y: y, h : rect.height || 0 };
        }            
        
    };
    
    window.IslandBlock = IslandBlock;

}());
