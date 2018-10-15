{
    const findBefore = (oldText, oldParts, newWords, maxIndex) => {
        const newWordsLength = newWords.length;

        maxIndex = Math.min(maxIndex, oldParts.length - 1, newWordsLength - 1);

        // Using a for loop is approximately 6 times faster than findIndex after initial stablization period
        let charCount = 0;
        let beforeIndex = -1;
        for (let n = 0; n < newWordsLength; n += 1) {
            if (n >= maxIndex || newWords[n] !== oldParts[n]) {
                beforeIndex = n;
                break;
            }

            charCount += newWords[n].length;
        }

        return {
            beforeIndex: beforeIndex,
            beforeText: oldText.substr(0, charCount),
        };
    };

    const findAfter = (oldText, oldParts, newWords) => {
        const newWordsLength = newWords.length;
        const oldPartsLength = oldParts.length;

        let charCount = 0;
        let afterIndex = -1;
        for (let n = 0; n < newWordsLength; n += 1) {
            // Use a forward loop to count backwards by index length subtraction
            const oldPartIndex = oldPartsLength - 1 - n;
            const newWord = newWords[newWordsLength - 1 - n];

            // If we reached the end of the newWords, all were copied. This happens when deleting from the front
            // Otherwise, if we pass the end of the oldParts, finish
            // Otherwise, if we find an actual difference, finish
            if (n === newWordsLength - 1 || oldPartIndex < 0 || newWord !== oldParts[oldPartIndex]) {
                afterIndex = n;
                break;
            }

            charCount += newWord.length;
        };

        return {
            afterIndex: afterIndex,
            afterText: oldText.substr(oldText.length - charCount),
        };
    };

    const findInitialChanges = (oldText, oldParts, newText) => {
        const newWords = newText.split(/(\s+)/g);

        const after = findAfter(oldText, oldParts, newWords);
        const before = findBefore(oldText, oldParts, newWords, oldParts.length - after.afterIndex);

        return {
            beforeParts: oldParts.slice(0, before.beforeIndex),
            newParts: newWords.slice(before.beforeIndex, newWords.length - after.afterIndex),
            afterParts: oldParts.slice(oldParts.length - after.afterIndex),

            beforeText: before.beforeText,
            betweenOldText: oldText.substr(before.beforeText.length, oldText.length - after.afterText.length - before.beforeText.length),
            betweenNewText: newText.substr(before.beforeText.length, newText.length - after.afterText.length - before.beforeText.length),
            afterText: after.afterText,
        };
    };

    const expandChanges = (changes, isToEnglish) => {
        // If the backtick count goes from odd to even, or even to odd, rather than remaining the same, then the entire rest of the string needs to be re-evaluated
        if ((changes.betweenOldText.match(/`/g) || []).length % 2 !== (changes.betweenNewText.match(/`/g) || []).length % 2) {
            changes.newParts = changes.newParts.concat(changes.afterParts);
            changes.afterParts = [];
            changes.betweenOldText = changes.betweenOldText + changes.afterText;
            changes.betweenNewText = changes.betweenNewText + changes.afterText;
            changes.afterText = '';
        }
        else if (isToEnglish) {
            // Check the afterParts for a starting word containing potential capital Y
            if (changes.afterParts.length > 0 && (/^['"]*0[A-Za-z']/).test(changes.afterParts[0])) {
                const shiftedPart = changes.afterParts[0];
                changes.newParts = changes.newParts.concat(shiftedPart);
                changes.afterParts = changes.afterParts.slice(1);
                changes.betweenOldText = changes.betweenOldText + shiftedPart;
                changes.betweenNewText = changes.betweenNewText + shiftedPart;
                changes.afterText = changes.afterText.substr(shiftedPart.length);
            }
            else if (changes.afterParts.length > 1 && (/^['"]*0[A-Za-z']/).test(changes.afterParts[1])) {
                const shiftedParts = [changes.afterParts[0], changes.afterParts[1]];
                const shiftedPartsText = shiftedParts[0] + shiftedParts[1];
                changes.newParts = changes.newParts.concat(shiftedParts);
                changes.afterParts = changes.afterParts.slice(2);
                changes.betweenOldText = changes.betweenOldText + shiftedPartsText;
                changes.betweenNewText = changes.betweenNewText + shiftedPartsText;
                changes.afterText = changes.afterText.substr(shiftedPartsText.length);
            }
        }

        return changes;
    };

    const convert = (text, conversion) => {
        const chars = text.split('');
        const charsLength = text.length;
        for (let c = 0; c < charsLength; c += 1) {
            const charCode = chars[c].charCodeAt(0);
            chars[c] = 65 <= charCode && charCode <= 122 ? conversion.charAt(charCode - 65) : chars[c];
        }
        return chars.join('');
    };

    const englishToSaurianNewParts = (beforeText, newParts) => {
        let tickCount = (beforeText.match(/`/g) || []).length;
        const translatedParts = [];

        const length = newParts.length;
        for (let n = 0; n < length; n += 1) {
            // If part only contains whitespace, just push it straight through
            if ((/\s+/g).test(newParts[n])) {
                translatedParts.push(newParts[n]);
                continue;
            }

            const properNounParts = newParts[n].split(/(`)/g);
            const properNounPartsLength = properNounParts.length;

            const translatedPartArray = [];

            for (let p = 0; p < properNounPartsLength; p += 1) {
                let part = properNounParts[p];

                if (part === '`') {
                    translatedPartArray.push('`');
                    tickCount += 1;
                    continue;
                }

                if (tickCount % 2 === 1) {
                    // Don't translate the parts that are indicated as Proper Nouns
                    translatedPartArray.push(part);
                    continue;
                }

                translatedPartArray.push(convert(part, 'URSTOVWXAZBCMDEFGHJKILNP0Q[\\]^_`urstovwxazbcmdefghjkilnp0q'));
            }

            translatedParts.push(translatedPartArray.join(''));
        }

        return translatedParts;
    };

    const saurianToEnglishNewParts = (beforeText, newParts) => {
        let tickCount = (beforeText.match(/`/g) || []).length;
        const translatedParts = [];

        // Start of the entire string counts as the end of a sentence to allow an initial 0 to be capital Y
        let isEndOfSentence = beforeText === '' || (/[.?!][\s'"]*$/).test(beforeText);

        const length = newParts.length;
        for (let n = 0; n < length; n += 1) {
            // If part only contains whitespace, just push it straight through
            if ((/\s+/g).test(newParts[n])) {
                isEndOfSentence = false;
                translatedParts.push(newParts[n]);
                continue;
            }

            const properNounParts = newParts[n].split(/(`)/g);
            const properNounPartsLength = properNounParts.length;

            const translatedPartArray = [];

            for (let p = 0; p < properNounPartsLength; p += 1) {
                let part = properNounParts[p];

                if (part === '`') {
                    translatedPartArray.push('`');
                    tickCount += 1;
                    continue;
                }

                if (tickCount % 2 === 1) {
                    // Don't translate the parts that are indicated as Proper Nouns
                    translatedPartArray.push(part);
                    isEndOfSentence = (/[.?!][\s'"]*$/).test(part);
                    continue;
                }

                if (isEndOfSentence) {
                    // Capitalize beginning of sentence Y's
                    part = part.replace(/^([\s"']*)0([A-Za-z'])/, '$1Y$2');
                }

                // Capitalize beginning of sentence Y's in the case of no spaces
                part = part.replace(/([.?!][\s"']*)0([A-Za-z'])/g, '$1Y$2');

                // If not preceeded with a number or dot, the 0 becomes y
                part = part.replace(/([^0-9\.])0/g, '$1y');

                // If not followed by a number or dot, OR followed only by a dot and not a number after that, the 0 becomes y
                part = part.replace(/0([^0-9\.]|\.[^0-9])/g, 'y$1');

                translatedPartArray.push(convert(part, 'IKLNOPQRUSTVMWEXZBCDAFGHYJ[\\]^_`iklnopqrustvmwexzbcdafghyj'));
                isEndOfSentence = (/[.?!][\s'"]*$/).test(part);
            }

            translatedParts.push(translatedPartArray.join(''));
        }

        return translatedParts;
    };

    const addClass = (el, className) => {
        const unique = [];
        const set = {};
        const classNames = (el.className === '' ? [] : el.className.split(/\s+/g)).concat(className);
        const classNamesLength = classNames.length;
        for (let n = 0; n < classNamesLength; n += 1) {
            const name = classNames[n];

            if (set[name]) {
                continue;
            }

            set[name] = 1;
            unique.push(name);
        }
        el.className = unique.join(' ');
    };

    const removeClass = (el, className) => {
        const unique = [];
        const set = {};
        const classNames = el.className === '' ? [] : el.className.split(/\s+/g);
        const classNamesLength = classNames.length;
        for (let n = 0; n < classNamesLength; n += 1) {
            const name = classNames[n];

            if (set[name] || name === className) {
                continue;
            }

            set[name] = 1;
            unique.push(name);
        }
        el.className = unique.join(' ');
    };

    const updateSpans = (spansBox, oldParts, beforePartsLength, newParts, afterPartsLength, spanCount) => {
        const newPartsLength = newParts.length;
        const oldPartsChangeLength = oldParts.length - beforePartsLength - afterPartsLength;
        const addBeforeNode = spansBox.childNodes[oldParts.length - afterPartsLength] || null;
        const overlapLength = Math.min(oldPartsChangeLength, newPartsLength);

        // Reuse existing spans and just change text if we can
        for (let o = 0; o < overlapLength; o += 1) {
            if (oldParts[o + beforePartsLength] !== newParts[o]) {
                const span = spansBox.childNodes[o + beforePartsLength];
                span.textContent = newParts[o];
                if (!(/\s/).test(newParts[o])) {
                    addClass(span, 'word');
                }
            }
        }

        // If there are more old parts than new parts, remove the remaining spans
        if (newPartsLength < oldPartsChangeLength) {
            const nodesToRemove = [].slice.call(spansBox.childNodes, beforePartsLength + overlapLength, beforePartsLength + overlapLength + (oldPartsChangeLength - newPartsLength));
            const nodesToRemoveLength = nodesToRemove.length;
            for (let r = 0; r < nodesToRemoveLength; r += 1) {
                spansBox.removeChild(nodesToRemove[r]);
            }
        }
        // Otherwise, if there are more new parts than old parts, add the remaining spans
        else if (newPartsLength > oldPartsChangeLength) {
            const addUntilIndex = overlapLength + newPartsLength - oldPartsChangeLength;
            for (let a = overlapLength; a < addUntilIndex; a += 1) {
                spanCount += 1;

                const span = document.createElement('span');
                span.textContent = newParts[a];
                span.setAttribute('data-c', spanCount);
                if (!(/\s/).test(newParts[a])) {
                    addClass(span, 'word');
                }
                spansBox.insertBefore(span, addBeforeNode);
            }
        }

        return spanCount;
    };


    const state = {
        scrollSide: '',
        spanCount: 0,
        english: {
            text: '',
            parts: [''],
            elements: {
                textarea: document.getElementById('english'),
                spansBox: document.getElementById('englishWords'),
                falseTextarea: document.getElementById('english').parentNode.parentNode.parentNode.parentNode,
                scrollArea: document.getElementById('english').parentNode.parentNode,
                properNounButton: document.getElementById('englishProperNoun'),
            },
            listeners: {
                scroll: () => {
                    state.saurian.elements.scrollArea.scrollTop = state.english.elements.scrollArea.scrollTop;
                },
            },
        },
        saurian: {
            text: '',
            parts: [''],
            elements: {
                textarea: document.getElementById('saurian'),
                spansBox: document.getElementById('saurianWords'),
                falseTextarea: document.getElementById('saurian').parentNode.parentNode.parentNode.parentNode,
                scrollArea: document.getElementById('saurian').parentNode.parentNode,
                properNounButton: document.getElementById('saurianProperNoun'),
            },
            listeners: {
                scroll: () => {
                    state.english.elements.scrollArea.scrollTop = state.saurian.elements.scrollArea.scrollTop;
                },
            },
        },

        tooglePronunciationButton: document.getElementById('tooglePronunciationButton'),
        pronunciationBox: document.getElementById('pronunciationBox'),
        ipaWords: document.getElementById('ipaWords'),
        commonWords: document.getElementById('commonWords'),

        mouse: {
            x: 0,
            y: 0,
        },
        lastHovered: void 0,
        lastOther: void 0,
    };

    const throttle = (callback) => {
        let used = false;
        return (...args) => {
            if (!used) {
                used = true;

                callback(...args);

                window.requestAnimationFrame(() => {
                    used = false;
                });
            }
        };
    };

    const clearHovers = () => {
        if (state.lastHovered) {
            removeClass(state.lastHovered, 'active');
        }
        if (state.lastOther) {
            removeClass(state.lastOther, 'active');
        }

        state.lastHovered = void 0;
        state.lastOther = void 0;
    };

    const onMouseHoverBase = (to) => {
        const hovered = document.elementsFromPoint(state.mouse.x, state.mouse.y);
        // console.log(hovered)
        const span = hovered.find((el) => {
            return el.nodeName.toLowerCase() === 'span' && (/\bword\b/).test(el.className);
        });

        if (!span) {
            // No longer hovering a span, clean up
            clearHovers();
            return;
        }
        if (span === state.lastHovered) {
            // Nothing actually changed
            return;
        }

        // At this point, it is known that a new hover occurred, clean up before proceeding
        clearHovers();

        const spanNumber = span.getAttribute('data-c');

        state.lastHovered = span;
        state.lastOther = to.elements.spansBox.querySelector(`span[data-c="${spanNumber}"]`) || void 0;

        addClass(state.lastHovered, 'active');
        addClass(state.lastOther, 'active');
    };

    const setupEvents = (from, to) => {
        const initialEmptySpan = document.createElement('span');
        initialEmptySpan.textContent = '';
        initialEmptySpan.setAttribute('data-c', state.spanCount);
        from.elements.spansBox.appendChild(initialEmptySpan);

        from.elements.textarea.addEventListener('focus', () => {
            addClass(from.elements.falseTextarea, 'focus');
        });

        from.elements.textarea.addEventListener('blur', () => {
            removeClass(from.elements.falseTextarea, 'focus');
        });

        const throttledOnMouseHover = throttle(onMouseHoverBase);

        from.elements.scrollArea.addEventListener('mousemove', (e) => {
            state.mouse.x = e.pageX;
            state.mouse.y = e.pageY;

            throttledOnMouseHover(to);
        });

        from.elements.scrollArea.addEventListener('mouseout', clearHovers);

        from.elements.scrollArea.addEventListener('scroll', from.listeners.scroll);

        from.elements.properNounButton.addEventListener('click', () => {
            // TODO: add backticks to both sides
        });

        from.elements.textarea.addEventListener('input', (e) => {
            const newText = e.target.value;

            if (newText === from.text) {
                return;
            }

            const startSpanCount = state.spanCount;
            let newSpanCount;

            // Update source
            let changes = findInitialChanges(from.text, from.parts, newText);
            changes = expandChanges(changes, from === state.saurian);
            newSpanCount = updateSpans(from.elements.spansBox, from.parts, changes.beforeParts.length, changes.newParts, changes.afterParts.length, startSpanCount);
            from.parts = changes.beforeParts.concat(changes.newParts, changes.afterParts);
            from.text = newText;

            if (from === state.english) {
                // English updated, mirror translated updates to Saurian
                const saurianNewParts = englishToSaurianNewParts(changes.beforeText, changes.newParts);
                updateSpans(to.elements.spansBox, to.parts, changes.beforeParts.length, saurianNewParts, changes.afterParts.length, startSpanCount);
                to.parts = to.parts.slice(0, changes.beforeParts.length).concat(saurianNewParts, to.parts.slice(to.parts.length - changes.afterParts.length));
                to.text = `${to.text.substr(0, changes.beforeText.length)}${saurianNewParts.join('')}${to.text.substr(to.text.length - changes.afterText.length)}`;
                to.elements.textarea.value = to.text;
            }
            else {
                // Saurian updated, mirror translated updates to English
                const englishNewParts = saurianToEnglishNewParts(changes.beforeText, changes.newParts);
                updateSpans(to.elements.spansBox, to.parts, changes.beforeParts.length, englishNewParts, changes.afterParts.length, startSpanCount);
                to.parts = to.parts.slice(0, changes.beforeParts.length).concat(englishNewParts, to.parts.slice(to.parts.length - changes.afterParts.length));
                to.text = `${to.text.substr(0, changes.beforeText.length)}${englishNewParts.join('')}${to.text.substr(to.text.length - changes.afterText.length)}`;
                to.elements.textarea.value = to.text;
            }

            // TODO: add pronunciation changes here


            state.spanCount = newSpanCount;
        });
    };

    state.english.elements.textarea.value = state.english.text;
    state.saurian.elements.textarea.value = state.saurian.text;

    setupEvents(state.english, state.saurian);
    setupEvents(state.saurian, state.english);

    window.addEventListener('blur', clearHovers);

    state.tooglePronunciationButton.addEventListener('click', () => {
        let isOpen = !(/\bactive\b/).test(state.pronunciationBox.className);

        if (isOpen) {
            addClass(state.pronunciationBox, 'active');
            addClass(state.tooglePronunciationButton, 'active');
            state.tooglePronunciationButton.textContent = '▼ Pronunciations';
        }
        else {
            removeClass(state.pronunciationBox, 'active');
            removeClass(state.tooglePronunciationButton, 'active');
            state.tooglePronunciationButton.textContent = '▶ Pronunciations';
        }
    });
}