{

const engProperNounButton = document.getElementById('ePN');
const engTextBox = document.getElementById('eB');
const engTextarea = document.getElementById('e');
const engHighlighter = document.getElementById('eH');

const sauProperNounButton = document.getElementById('sPN');
const sauTextBox = document.getElementById('sB');
const sauTextarea = document.getElementById('s');
const sauHighlighter = document.getElementById('sH');

const pronunciationBox = document.getElementById('p');
const pronunciationToggleButton = document.getElementById('pB');
const ipaText = document.getElementById('i');
const commonText = document.getElementById('c');

let isHidden = (/hide/).test(pronunciationBox.className);

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

pronunciationToggleButton.addEventListener('click', () => {
    isHidden = !isHidden;

    if (isHidden) {
        pronunciationBox.className = pronunciationBox.className + ' hide';
        pronunciationToggleButton.innerHTML = '▶ Show Pronunciations';
    }
    else {
        pronunciationBox.className = pronunciationBox.className.replace(' hide', '');
        pronunciationToggleButton.innerHTML = '▼ Hide Pronunciations';
    }
});

const preprocessSaurianY = (text) => {
    return text
        // Case: first word starts with a Saurian Y
        .replace(/(^[\s'"]*)0([A-Za-z'])/g, "$1Y$2")

        // Case: sentences beginning with a Saurian Y
        .replace(/([\.\!\?][\s'"]+)0([A-Za-z'])/g, "$1Y$2")

        // Case: all other non-numerical Saurian Y's
        .replace(/([^0-9])0([^0-9\.]|(\.[^0-9]))/g, "$1y$2");
};

const convert = (text, conversion) => {
    return text.split('').map((c) => {
        const charCode = c.charCodeAt(0);
        return 65 <= charCode && charCode <= 122 ? conversion.charAt(charCode - 65) : c;
    }).join('');
};

const parseConvert = (text, op) => {
    return text.split('\\').map((part, index) => {
        return index % 2 ? part : op(part);
    }).join('');
};

const detectProperNouns = (text, capitalWordDetector) => {
    return text.split('\\').map((part, index, list) => {
        if (index % 2 !== 0) {
            return part;
        }

        // Surround all capital words that are not "I" contractions with backslashes
        // In Saurian to English version, the "I" contractions are actually "A" contractions
        part = part.replace(capitalWordDetector, '\\$&\\');

        // Remove the surrounding backslashes for capital words at the beginning of sentences
        part = part.replace(/([\.\!\?][\s'"]+)\\([A-Za-z0']+)\\/g, '$1$2');

        if (index === 0) {
            // At the very beginning of the string, undo any proper noun values for a capital word that appears first
            part = part.replace(/^([\s'"]*)\\([A-Za-z0']+)\\/g, '$1$2');
        }

        return part;
    }).join('\\');
};

const engToSau = (text) => {
    return convert(text, 'URSTOVWXAZBCMDEFGHJKILNP0Q[\\]^_`urstovwxazbcmdefghjkilnp0q');
};

const sauToEng = (text) => {
    return convert(preprocessSaurianY(text), 'IKLNOPQRUSTVMWEXZBCDAFGHYJ[\\]^_`iklnopqrustvmwexzbcdafghyj');
};

const spanner = (text, type) => {
    let index = 0;
    return text.replace(/\b(\w+)\b/g, (match) => {
        const replacement = `<span data-where="${type}-${index}">${match}</span>`;
        index += 1;
        return replacement;
    }) + '\n';
    // The extra newline is to account for how the textarea might have a newline with no text content at the end
};

const getHeight = (el) => {
    const box = el.getBoundingClientRect();
    return box.bottom - box.top;
};

const syncHeight = () => {
    const maxHeight = Math.max(getHeight(engHighlighter), getHeight(sauHighlighter));
    engTextarea.style.height = `${maxHeight}px`;
    sauTextarea.style.height = `${maxHeight}px`;
};

const onChangeEng = () => {
    const input = engTextarea.value;
    const output = parseConvert(input, engToSau);
    engHighlighter.innerHTML = spanner(input, 'eng');
    sauHighlighter.innerHTML = spanner(output, 'sau');
    sauTextarea.value = output;

    syncHeight();
    sauTextBox.scrollTop = engTextBox.scrollTop;
};

const onChangeSau = () => {
    const input = sauTextarea.value;
    const output = parseConvert(input, sauToEng);
    sauHighlighter.innerHTML = spanner(input, 'sau');
    engHighlighter.innerHTML = spanner(output, 'eng');
    engTextarea.value = output;

    syncHeight();
    engTextBox.scrollTop = sauTextBox.scrollTop;
};

engTextarea.addEventListener('input', onChangeEng);
sauTextarea.addEventListener('input', onChangeSau);

engTextarea.addEventListener('focus', () => {
    engTextBox.className += ' focus';
});

sauTextarea.addEventListener('focus', () => {
    sauTextBox.className += ' focus';
});

engTextarea.addEventListener('blur', () => {
    engTextBox.className = engTextBox.className.replace(' focus', '');
});

sauTextarea.addEventListener('blur', () => {
    sauTextBox.className = sauTextBox.className.replace(' focus', '');
});

engTextBox.addEventListener('scroll', () => {
    sauTextBox.scrollTop = engTextBox.scrollTop;
});

sauTextBox.addEventListener('scroll', () => {
    engTextBox.scrollTop = sauTextBox.scrollTop;
});

engProperNounButton.addEventListener('click', () => {
    engTextarea.value = detectProperNouns(engTextarea.value, /\b[A-HJ-Z][A-Za-z']+|I[A-Za-z][A-Za-z']*/g);
    onChangeEng();
});

sauProperNounButton.addEventListener('click', () => {
    sauTextarea.value = detectProperNouns(sauTextarea.value, /\b[B-Z][A-Za-z']+|A[A-Za-z][A-Za-z']*/g);
    onChangeSau();
});


const mouse = {
    x: 0,
    y: 0,
};

let lastHovered = void 0;
let lastOther = void 0;

const clearHovers = () => {
    if (lastHovered) {
        lastHovered.className = lastHovered.className.replace(' active', '');
    }
    if (lastOther) {
        lastOther.className = lastOther.className.replace(' active', '');
    }

    lastHovered = void 0;
    lastOther = void 0;
};

const onMouseHover = () => {
    const hovered = document.elementsFromPoint(mouse.x, mouse.y);
    const span = hovered.find((el) => {
        return el.nodeName.toLowerCase() === 'span' && el.getAttribute('data-where');
    });

    if (!span) {
        // No longer hovering a span, clean up
        clearHovers();
        return;
    }
    if (span === lastHovered) {
        // Nothing actually changed
        return;
    }

    // At this point, it is known that a new hover occurred, clean up before proceeding
    clearHovers();

    const where = span.getAttribute('data-where');
    const otherType = where.substr(0, 3) === 'eng' ? 'sau' : 'eng';
    const otherWhere = otherType + where.substr(3);
    const box = otherType === 'eng' ? engTextBox : sauTextBox;

    lastHovered = span;
    lastOther = box.querySelector(`span[data-where="${otherWhere}"]`) || void 0;

    lastHovered.className += ' active';
    lastOther.className += ' active';
};



const throttledOnMouseHover = throttle(onMouseHover);

engTextBox.addEventListener('mousemove', (e) => {
    mouse.x = e.pageX;
    mouse.y = e.pageY;

    throttledOnMouseHover();
});

sauTextBox.addEventListener('mousemove', (e) => {
    mouse.x = e.pageX;
    mouse.y = e.pageY;

    throttledOnMouseHover();
});

engTextBox.addEventListener('mouseout', clearHovers);

sauTextBox.addEventListener('mouseout', clearHovers);

window.addEventListener('blur', clearHovers);

}