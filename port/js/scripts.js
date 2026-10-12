/**
 * Word Perhect's scripts, ported by hand from the original Flash 4 ActionScript
 *
 * The originals were decompiled with JPEXS FFDec. Each script is keyed as in
 * the SWF: frame scripts by timeline and frame ("root:212", "150:1"), button
 * scripts by button and event (31: { release }). Where a script was repeated
 * across many buttons or clips (tooltips, the thesaurus, the alerts, the
 * paper and pen choices) it is written once and set up from a table.
 *
 * Scripts get `_`, the Flash 4 actions for the timeline they are in (see
 * Script in flash.js). Flash 4 compared with numbers (eq), joined strings
 * with add (+ on strings here) and counted string positions from 1.
 *
 * Changed from the original:
 *  - loading and saving go to storage.js instead of the server (as before,
 *    through loadVariables)
 *  - ifFrameLoaded is always true: everything is loaded before the piece starts
 */
import { str } from './flash.js';

/* the text on the chosen paper, as a variable path */
const pageText = _ => `/paper/p${str(_.get('/:pap'))}/size${str(_.get('/:size'))}/:m`;
const pageTextFrom = (_, up) => `${up}paper/p${str(_.get(up + ':pap'))}/size${str(_.get(up + ':size'))}`;

const stop = _ => _.stop();
const gotoAndStop = frame => _ => _.gotoAndStop(frame);
const gotoAndPlay = frame => _ => _.gotoAndPlay(frame);

/* each paper's name, and where it was found */
const PAPERS = {
    1: ['cig insert', 'my bag'],
    2: ['receipt', 'my bag'],
    3: ['travel card', 'my bag'],
    4: ['telephone bill back', 'my pocket'],
    5: ['photo envelope', 'my pocket'],
    6: ['back of an a-z', 'my pocket'],
    7: ['plug paper', 'my studio'],
    8: ['cardboard', 'my studio'],
    9: ['old calendar', 'my studio'],
};
const paperType = _ => {
    const paper = PAPERS[str(_.get('pap'))];
    if (paper) {
        _.set('papertype', paper[0]);
        _.set('location', paper[1]);
    }
};

/**
 * perhect.swf
 */
const perhect = { frames: {}, buttons: {} };
const F = perhect.frames;
const B = perhect.buttons;

/* the main timeline */
Object.assign(F, {
    /* the preloaders: everything is already loaded */
    'root:1': gotoAndPlay(48),
    'root:30': gotoAndPlay(1),
    'root:93': gotoAndPlay(103),
    'root:102': gotoAndPlay(93),
    'root:145': gotoAndPlay(164),
    'root:155': gotoAndPlay(103),
    'root:163': gotoAndPlay(164),
    'root:166': stop,
    'root:168': stop,
    'root:175': stop,
    'root:184': stop,
    'root:194': stop,
    /* wait for the saved texts */
    'root:212': _ => {
        if (_.eq(_.get('loaded'), 1)) {
            _.gotoAndStop(164);
        } else {
            _.play();
        }
    },
    'root:218': gotoAndPlay(212),
    'root:219': stop,
    'root:225': stop,
    /* retrieve data */
    'root:226': _ => {
        _.set('i', '0');
        _.set('count', '0');
        _.set('index', '1');
        _.loadVariables(`perhect${str(_.get('pap'))}.asp?action=rd`, '', 'POST');
        _.loadVariables('tips.asp?action=rd', '', 'POST');
    },
    /* check: the loading bar */
    'root:234': _ => {
        _.set('FrameLoad', _.int(100 / _.getProperty('', '_totalframes') * _.getProperty('', '_framesloaded')));
        _.tell('/loader', t => t.gotoAndStop(_.get('/:FrameLoad')));
    },
    'root:240': gotoAndPlay(249),
    'root:241': gotoAndPlay(234),
    'root:243': gotoAndStop(249),
    'root:247': gotoAndPlay(243),
    'root:248': _ => {
        _.stop();
        _.gotoAndStop(249);
    },
    /* sign: ready to write */
    'root:249': _ => {
        paperType(_);
        _.loadVariables('tips.asp?action=rd', '', 'POST');
        _.loadMovieNum('tip.swf', 99, 'GET');
        _.set('DiceRoll', _.random(46));
        _.set('tipnum', _.add(_.get('DiceRoll'), 1));
        _.set('name', '');
        _.set('email', '');
        _.set('url', '');
        _.set('i', '0');
        _.set('_level99/:tiptext', _.get('jname' + str(_.get('tipnum'))));
        _.stop();
        _.set('targ', '"/paper/p" & pap & "/size" & size');
        _.set('m', `/paper/p${str(_.get('pap'))}/size${str(_.get('size'))}/:m`);
        /* in the original this targets the string above, which isn't a clip, so it does nothing */
        _.tell(_.get('targ'), t => t.gotoAndPlay('size' + str(_.add(_.get('/:pap') * 3, _.get('/:size')))));
    },
    /* continue */
    'root:256': _ => {
        paperType(_);
        _.stop();
    },
    /* open */
    'root:263': _ => {
        _.set('Dname', _.get('name' + str(_.get('count'))));
        _.set('index', _.get('count'));
    },
    'root:266': stop,
    'root:271': _ => _.loadVariables(`perhect${str(_.get('pap'))}.asp?action=rd`, '', 'POST'),
    'root:291': _ => {
        if (_.eq(_.get('loaded'), 1)) {
            _.gotoAndStop(297);
        } else {
            _.gotoAndPlay(288);
        }
    },
    'root:295': gotoAndPlay(291),
    /* opening, and saving: wait for the answer */
    'root:301': _ => {
        if (_.eq(_.get('confirm'), 1)) {
            _.gotoAndPlay(256);
        } else if (_.eq(_.get('cconfirm'), 1)) {
            _.tell('/signing_error', t => t.gotoAndStop('error'));
        } else {
            _.gotoAndPlay(297);
        }
    },
    'root:306': _ => {
        _.stop();
        _.tell(`/paper/p${str(_.get('pap'))}/size${str(_.get('size'))}/getkeys`, t => t.gotoAndStop('nokeys'));
    },
    'root:320': _ => {
        if (_.eq(_.get('confirm'), 1)) {
            _.gotoAndPlay(256);
            /* another target which is a string, not a clip, in the original */
            _.tell('"/paper/p" & pap & "/size" & size & "/getkeys"', t => t.gotoAndStop(1));
        } else if (_.eq(_.get('cconfirm'), 1)) {
            _.tell('/signing_error', t => t.gotoAndStop('error'));
        } else {
            _.gotoAndPlay(310);
        }
    },
    'root:324': gotoAndPlay(164),
});

/* clips which just stop */
[
    '135:1', '139:1', '147:1', '283:1', '284:1', '314:1', '315:1', '343:1',
    '456:1', '459:1', '462:1', '465:1', '468:1', '471:1', '503:1', '534:1', '564:1',
    '602:1', '605:1', '626:1', '643:1', '646:1', '646:6', '652:1', '670:1', '682:1', '682:2', '683:1',
    '709:1', '709:18', '709:30', '709:42', '709:54', '709:66', '709:78', '709:90', '709:102', '709:114',
    '709:126', '709:138', '709:150', '709:162', '709:174', '709:186', '709:198', '709:210', '709:222',
    '709:234', '709:246', '709:258', '709:270', '709:282', '709:294',
    '716:1', '721:1', '724:1', '728:1', '731:1', '734:1', '737:1', '740:1', '743:1', '746:1', '749:1',
    '752:1', '755:1', '758:1', '761:1', '771:1', '777:1', '778:1', '789:1', '793:1', '796:1',
    '800:1', '800:7', '847:38', '865:1',
].forEach(k => F[k] = stop);

/**
 * The pen choice: radio buttons. Each one registers with its group (the
 * clip it is in) on its first frame, and pressing one sets all the others
 * back to frame 1. Frame 2 of each records the choice.
 */
const radioInit = _ => {
    if (_.eq(_.get('initialized'), 0)) {
        _.set('initialized', '1');
        _.set('numChildren', _.get('../:numChildren'));
        _.set('..:numChildren', _.add(_.get('numChildren'), 1));
        _.set('numChildren', _.add(_.get('numChildren'), 1));
        _.set('arrayElement', '..:child_' + str(_.get('numChildren')));
        _.set(_.get('arrayElement'), _.target);
    }
    _.stop();
};
const radioGroupInit = _ => {
    if (_.eq(_.get('initialized'), 0)) {
        _.set('initialized', '1');
        _.set('numChildren', '0');
    }
};
const radioPress = _ => {
    _.set('numChildren', _.get('..:numChildren'));
    _.set('counter', '1');
    while (!_.lt(_.get('numChildren'), _.get('counter'))) {
        _.set('arrayElement', '..:child_' + str(_.get('counter')));
        _.set('control', _.get(_.get('arrayElement')));
        _.tell(_.get('control'), t => t.gotoAndStop(1));
        _.set('counter', _.add(_.get('counter'), 1));
    }
    _.set('..:selected', _.target);
    _.gotoAndStop(2);
};
Object.assign(F, {
    '118:1': radioInit, '118:2': _ => _.set('/:pen', '1'),
    '120:1': radioInit, '120:2': _ => _.set('/:pen', '2'),
    '122:1': radioInit, '122:2': _ => _.set('/:pen', '3'),
    '123:1': radioGroupInit,
    '125:1': radioInit, '125:2': _ => _.set('/:size', '1'),
    '127:1': radioInit, '127:2': _ => _.set('/:size', '2'),
    '129:1': radioInit, '129:2': _ => _.set('/:size', '3'),
    '130:1': radioGroupInit,
});
[116, 119, 121, 124, 126, 128].forEach(id => B[id] = { press: radioPress });

/**
 * The papers: each paper clip shows its own size, once the paper and size
 * have been chosen, and the pen clips inside show the chosen pen
 */
const penFrames = (messy, tidy, hardly) => _ => {
    if (_.eq(_.get('/:pen'), 1)) {
        _.gotoAndStop(messy);
    } else if (_.eq(_.get('/:pen'), 2)) {
        _.gotoAndStop(tidy);
    } else if (_.eq(_.get('/:pen'), 3)) {
        _.gotoAndStop(hardly);
    }
};
F['150:1'] = _ => {
    _.stop();
    penFrames(1, 7, 13)(_);
};
F['150:17'] = stop;
F['154:1'] = penFrames(1, 7, 12);
F['154:16'] = stop;
[158, 165, 169, 173, 180, 184, 188, 195, 199, 203, 210, 214, 218, 225, 229, 233, 240, 244, 248, 255, 259, 263, 271, 276, 280].forEach(id => {
    F[`${id}:1`] = _ => {
        _.stop();
        penFrames(1, 7, 12)(_);
    };
    F[`${id}:16`] = stop;
});
/* paper clip: [paper, frame for small, normal, big] */
[
    [159, 1, 5, 11, 17], [174, 2, 4, 8, 15], [204, 3, 4, 8, 15], [189, 4, 4, 8, 15], [219, 5, 4, 9, 16],
    [234, 6, 4, 9, 16], [249, 7, 4, 9, 16], [264, 8, 4, 9, 16], [281, 9, 4, 9, 16],
].forEach(([id, paper, ...frames]) => {
    F[`${id}:1`] = _ => {
        for (let size = 1; size <= 3; size++) {
            if (_.eq(_.get('/:size'), size) && _.eq(_.get('/:pap'), paper)) {
                _.gotoAndStop(frames[size - 1]);
                return;
            }
        }
    };
    F[`${id}:2`] = gotoAndPlay(1);
    F[`${id}:3`] = stop;
});

/* the arrows which move the paper around, 10 pixels a frame while held down */
const nudge = (prop, by) => _ => {
    const paper = '../p' + str(_.get('/:pap'));
    _.setProperty(paper, prop, _.add(_.getProperty(paper, prop), by));
};
[[283, '_x', 10], [284, '_x', -10], [314, '_y', 10], [315, '_y', -10]].forEach(([id, prop, by]) => {
    F[`${id}:2`] = nudge(prop, by);
    F[`${id}:3`] = _ => {
        nudge(prop, by)(_);
        _.gotoAndPlay(2);
    };
});
const hold = name => ({
    press: _ => _.tell(name, t => t.play()),
    release: _ => _.tell(name, t => t.gotoAndStop(1)),
});
B[310] = hold('loop2');
B[311] = hold('loopa');
B[312] = hold('loop2a');
B[313] = hold('loop');
[310, 311, 312, 313].forEach(id => {
    B[id].releaseOutside = B[id].release;
    B[id].dragOut = B[id].release;
});

/* the thesaurus's random words */
F['605:2'] = _ => {
    ['word1', 'word2', 'word3', 'word4'].forEach(word => _.tell(word, t => t.gotoAndStop(_.random(15))));
};

/* the "open" list of saved texts: a row for each */
F['840:1'] = _ => {
    _.stop();
    _.tell('/openeralert', t => t.gotoAndStop(2));
};
F['847:1'] = _ => _.set('n', '1');
F['847:11'] = _ => {
    while (!_.lt(_.get('../../../:count'), _.get('n'))) {
        const n = _.get('n');
        const row = 'row' + str(n);
        _.set('rn', row);
        _.duplicateMovieClip('row', row, _.add(n, 1) + 16384);
        _.setProperty(row, '_y', n * 33);
        _.set(row + ':MyRowIndex', _.get('../../../:name' + str(n)));
        _.set(row + ':MyRowNo', n);
        _.set('n', _.add(n, 1));
    }
    _.stop();
};

/* the scrolling list */
F['865:2'] = _ => {
    _.set('FieldHeight', _.getProperty('View/Field', '_height'));
    _.set('ViewHeight', _.getProperty('View/Mask', '_height'));
    _.setProperty('View/Field', '_y', -(_.get('FieldHeight') - _.get('ViewHeight')) * _.get('ScrollBarValue'));
};
const scrollbar = _ => {
    _.set('scrollbarsize', _.getProperty('..', '_height') - _.getProperty('../Down', '_height') - _.getProperty('../Up', '_height'));
    _.set('slidersize', _.getProperty('../scrollbarcontrol', '_height'));
};
const scrollTo = (_, y) => {
    _.setProperty('../scrollbarcontrol', '_y', y);
    _.set('../..:ScrollBarName', _.getProperty('..', '_target'));
    _.set('../..:ScrollBarValue', y / (_.get('scrollbarsize') - _.get('slidersize')));
    _.call('../..:ScrollUpdate');
};
B[850] = {
    press: _ => {
        _.call('../..:StartScroll');
        scrollbar(_);
        _.startDrag('', 0, 0, 0, 0, _.get('scrollbarsize') - _.get('slidersize'));
    },
    release: _ => {
        scrollbar(_);
        _.stopDrag();
        _.set('../..:ScrollBarName', _.getProperty('..', '_target'));
        _.set('../..:ScrollBarValue', _.getProperty('', '_y') / (_.get('scrollbarsize') - _.get('slidersize')));
        _.call('../..:ScrollUpdate');
        _.call('../..:StopScroll');
    },
};
B[854] = {
    press: _ => {
        scrollbar(_);
        let y = _.getProperty('../scrollbarcontrol', '_y') - _.get('slidersize');
        if (y < 0) y = 0;
        scrollTo(_, y);
    },
};
B[858] = {
    press: _ => {
        scrollbar(_);
        let y = _.getProperty('../scrollbarcontrol', '_y') + Number(_.get('slidersize'));
        const max = _.get('scrollbarsize') - _.get('slidersize');
        if (max < y) y = max;
        scrollTo(_, y);
    },
};

/**
 * The wizard: where the paper comes from, the paper, the pen
 */
Object.assign(B, {
    31: { release: gotoAndStop(168) },
    32: { release: gotoAndStop(184) },
    33: { release: gotoAndStop(194) },
    44: { release: gotoAndStop(175) },
    54: { release: _ => _.tell('../', t => t.gotoAndStop('pocket')) },
    68: { release: gotoAndStop(189) },
    70: { release: _ => _.tell('../', t => t.gotoAndStop('bag')) },
    88: { release: gotoAndStop(200) },
    90: { release: gotoAndStop(207) },
    93: { release: _ => _.tell('../', t => t.gotoAndStop('studio')) },
    97: { release: _ => _.tell('../', t => t.gotoAndStop('studio')) },
    /* ok: a pen and a size are needed */
    136: {
        press: _ => {
            if (_.eq(_.get('pen'), 0) || _.eq(_.get('size'), 0)) {
                _.tell('/alert', t => t.gotoAndStop('alert'));
            } else {
                _.gotoAndPlay(226);
            }
        },
    },
});
/* the papers: button, paper */
[[45, 1], [46, 2], [47, 3], [66, 4], [67, 5], [69, 6], [87, 7], [89, 8], [91, 9]].forEach(([id, paper]) => {
    B[id] = {
        release: _ => {
            _.set('pap', String(paper));
            _.gotoAndPlay(224);
        },
    };
});
/* changing paper while writing ("paperchoice"): button, paper, the paper's first size label */
[[825, 1, 0], [826, 2, 3], [827, 3, 6], [831, 4, 9], [832, 5, 12], [833, 6, 15], [837, 7, 18], [838, 8, 21], [839, 9, 24]].forEach(([id, paper, first]) => {
    B[id] = {
        press: _ => {
            _.tell('/paper/p' + str(_.get('/:pap')), t => t.gotoAndStop(2));
            /* the first three set the paper on the clip above, the rest on the main timeline: the same clip here */
            _.set(paper <= 3 ? '../:pap' : '/:pap', String(paper));
        },
        release: _ => {
            _.tell(`/paper/p${paper}`, t => t.gotoAndStop('size' + str(_.add(first, _.get('/:size')))));
            _.tell('/', t => {
                t.gotoAndStop('loopy4');
                t.play();
            });
        },
    };
});
B[825].release = _ => {
    _.tell('/paper/p1', t => t.gotoAndStop('size' + str(_.get('/:size'))));
    _.tell('/', t => {
        t.gotoAndStop('loopy4');
        t.play();
    });
};

/**
 * Typing: an invisible button with a key press for each key the piece knows.
 * Backspace doesn't delete: it rubs out the last letter with a *
 */
B[146] = {};
[
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    ' ', '!', ',', '-', '.', '/', ':', ';', '?', '@', '~',
].forEach(ch => {
    B[146]['key:' + ch.charCodeAt(0)] = _ => _.set('../:m', str(_.get('../:m')) + ch);
});
B[146]['key:34'] = _ => _.set('../:m', str(_.get('../:m')) + "'");
B[146]['key:13'] = _ => _.set('../:m', str(_.get('../:m')) + '\r');
B[146]['key:8'] = _ => {
    _.set('y', _.length(_.get('../:m')) - 1);
    _.set('../:m', _.substring(_.get('../:m'), 1, _.get('y')) + '*');
};

/* a test button left in the piece */
B[644] = {
    'key:65': _ => _.set('message', str(_.get('message')) + 'a'),
    'key:90': _ => {
        _.tell('/mymovclip', t => t.nextFrame());
        _.set('message', str(_.get('message')) + 'hello there');
    },
    'key:96': _ => {
        _.tell('/mymovclip', t => t.nextFrame());
        _.set('y', _.length(_.get('message')) - 1);
        _.set('message', _.substring(_.get('message'), 1, _.get('y')) + 'x');
    },
};

/**
 * The toolbar: a tooltip on rolling over each tool, and most of them open an alert
 */
const TOOLTIPS = {
    347: [28, 'bin'], 348: [26], 349: [27], 361: [11, 'compdelete'], 365: [8, 'thesaurus'],
    369: [9, 'spellcheck'], 373: [6, 'print'], 377: [7, 'mail'], 381: [3, 'new'], 385: [4, 'open'],
    389: [5, 'save'], 393: [10, 'delete'], 397: [18, 'cig'], 401: [19, 'drink'], 405: [20, 'food'],
    409: [17, 'tea'], 414: [12, 'cut'], 418: [13, 'copy'], 422: [14, 'paste'], 426: [15, 'bored'],
    431: [16, 'help'], 435: [24, 'alignright'], 439: [25, 'centre'], 443: [22, 'undo'], 447: [23, 'redo'],
    451: [21, 'sleep'],
};
Object.entries(TOOLTIPS).forEach(([id, [text, tip]]) => {
    B[id] = {
        rollOver: _ => _.tell('tooltext', t => {
            t.gotoAndStop(text);
            if (tip) {
                _.tell('tooltips', tt => {
                    tt.gotoAndStop(tip);
                    tt.play();
                });
            }
        }),
        rollOut: _ => _.tell('tooltext', t => {
            t.gotoAndStop(1);
            if (tip) _.tell('tooltips', tt => tt.gotoAndStop(1));
        }),
    };
});
/* tool: [event, alert clip, label] */
const ALERTS = {
    347: ['release', 'bin', 'bin'], 369: ['press', 'spellalert', 'spell'], 373: ['release', 'printalert', 'print'],
    377: ['release', 'mailalert', 'mail'], 389: ['release', 'savealert', 'save'], 397: ['release', 'cigalert', 'cig'],
    401: ['release', 'drinkalert', 'drink'], 405: ['release', 'foodalert', 'food'], 409: ['release', 'teaalert', 'tea'],
    414: ['release', 'cutalert', 'cut'], 418: ['release', 'copyalert', 'copy'], 422: ['release', 'pastealert', 'paste'],
    426: ['release', 'bored', 'bored'], 435: ['release', 'ar', 'ar'], 439: ['release', 'centring', 'centring'],
    443: ['release', 'undoalert', 'undo'], 447: ['release', 'redoalert', 'redo'], 451: ['release', 'sleepalert', 'sleep'],
};
Object.entries(ALERTS).forEach(([id, [event, clip, label]]) => {
    B[id][event] = _ => _.tell(clip, t => t.gotoAndStop(label));
});
Object.assign(B[361], {
    /* complete delete: the text becomes rubbish */
    press: _ => _.set(pageText(_), '[ ] [*@@*\r\r\r  [ [ ^ ][ \r\r^@ [] ][ {  \r\r~ [ } ]~^\r\r  *|[ ] [* []\r\r\r' +
        '                     ]] # [ {  ~ [ } ]~^ \r\r *|[ ] [*@@*  [ [ ^ ][\r\r ^@ [] ]] # [ {  ~\r\r\r' +
        ' [ } ]~^  *|[ ] [*@@*  [ [ ^ ][ ^@ [] ]] # [ {  ~\r\r [ \r\r} ]~^  *|[ ] [\r\r*@@*  [ [ ^ ][ ^@ \r\r\r' +
        '[] ]] # [ {  ~ [ } ]~^  *|[ ] [*@@*]~^ \r\r *|[ ] [*@@*  [ [ ^ ][ ^@ [] ]] # [\r\r {  ~ [ } \r\r' +
        ']~^  *|[ ] [*@@*  [ [ ^ ][\r\r ^@ [] ]] # \r\r[ {  ~ [ } ]~^\r\r\r  *|[ ] [\r\r' +
        '*@@*  [ [ ^ ][ ^@ [] ]] # [ {  ~ [ } ]~^  *|[ ]\r\r [*@@*  [ [ ^ ][ ^@ [] ]] # [ {  ~ [ } ]~^  ' +
        '*|[ ] [*@@*  [ [ ^ ][ ^@ [] ]] # [ {  ~ [ } ]~\r\r\r^  *|[ ] [*@@*  [ [ ^ ][ ^@ [] ]] # [ {  ~                     ' +
        '\r\r        [ } \r\r]~^  *|[ ] [*@@*  \r\r[ [ ^ ][ \r\r^@ [] ]] # [ {  ~ [ } ]~^  *['),
});
B[365].release = _ => _.tell('thes', t => t.gotoAndStop(2));
B[381].release = gotoAndPlay(164);
B[385].release = gotoAndPlay(263);
/* delete: the last four letters become a scribble */
B[393].press = _ => {
    const text = _.get(pageText(_));
    _.set(pageText(_), _.substring(text, 1, _.length(text) - 4) + '^][}');
};
B[431].release = _ => _.loadMovieNum('help.swf', 17, 'GET');

/**
 * The thesaurus: each word replaces the end of the text (button: [letters replaced, word, link])
 */
const THESAURUS = {
    474: [5, ' pack'], 476: [6, 'tetris'], 478: [7, 'mistake'], 480: [4, 'wind'], 482: [5, ' wave'],
    484: [9, ' penguins'], 486: [8, ' n*umber'], 488: [9, ' counting'], 490: [5, 'climb'], 492: [6, ' sorry'],
    494: [3, ' be'], 496: [5, ' help'], 498: [7, ' shower'], 500: [5, ' wash'], 502: [5, ' dish'],
    505: [5, ' tree'], 507: [6, ' ladder'], 509: [3, 'box'], 511: [4, 'tool'], 513: [14, ' creme caramel'],
    515: [5, ' large'], 517: [8, ' hammer'], 519: [6, ' snowy'], 521: [5, ' dark'], 523: [6, ' shiny'],
    525: [8, ' lizards'], 527: [10, ' dinosaurs'], 529: [4, ' etc'], 531: [5, ' fish'], 533: [9, ' lobsters'],
    536: [6, ' stars'], 538: [6, ' night'], 540: [3, 'sky'], 542: [4, 'kite'], 544: [10, ' boomerang'],
    546: [5, ' lump'], 548: [8, ' cooker '], 550: [4, ' oil'], 552: [7, ' bright'], 554: [17, ' incomprehensible'],
    556: [4, ' big'], 558: [6, ' small'], 559: [4, ' etc'], 561: [7, ' basket'], 563: [5, ' rain'],
    573: [4, ' see'], 575: [4, ' sea'], 577: [7, 'ceiling'], 579: [6, ' paint'], 581: [5, ' nail'],
    583: [5, ' heat'], 585: [11, ' marmalade '], 587: [7, ' smelly'], 589: [5, ' neat'], 591: [10, ' chocolate'],
    593: [4, ' hold'], 595: [5, ' fold'], 597: [6, ' brush'], 599: [8, ' seafood'],
    601: [8, ' reality', 'http://www.turtlereality.co.uk'], 603: [4, ' etc'],
};
Object.entries(THESAURUS).forEach(([id, [cut, word, url]]) => {
    B[id] = {
        press: _ => {
            const text = _.get(pageText(_));
            _.set(pageText(_), _.substring(text, 1, _.length(text) - cut) + word);
            _.tell('/thes', t => t.gotoAndStop(1));
            if (url) _.getURL(url);
        },
    };
});

/**
 * Menus, alerts and dialogs
 */
[
    133, 454, 458, 461, 464, 467, 470, 568, 613, 617, 633, 649, 654, 661, 668, 681, 715, 723, 730, 733, 736,
    739, 742, 745, 748, 751, 754, 757, 760, 762, 766, 773, 776, 788, 791, 795,
].forEach(id => {
    B[id] = Object.assign(B[id] || {}, { release: gotoAndStop(1) });
});
[610, 631].forEach(id => {
    B[id] = { press: gotoAndStop(1), rollOver: gotoAndStop(1), rollOut: gotoAndStop(1), dragOver: gotoAndStop(1) };
});
/* dragging alerts and the paper around */
B[51] = { press: _ => _.startDrag('', 0, 50, 100, 600, 700), release: _ => _.stopDrag() };
[452, 570, 653].forEach(id => B[id] = { press: _ => _.startDrag('', 0), release: _ => _.stopDrag() });
B[570].releaseOutside = B[570].release;
Object.assign(B, {
    /* the file and help menus */
    608: { press: menuOpen, release: menuOpen },
    630: { press: menuOpen, release: menuOpen },
    613: {
        press: _ => _.print(pageTextFrom(_, '../')),
        release: gotoAndStop(1),
    },
    614: {
        release: _ => {
            _.tell('../', t => {
                t.gotoAndStop('new');
                t.play();
            });
            _.gotoAndStop(1);
        },
    },
    615: {
        release: _ => {
            _.tell('../', t => {
                t.gotoAndStop('open');
                t.play();
            });
            _.gotoAndStop(1);
        },
    },
    616: {
        release: _ => {
            _.tell('../', t => t.gotoAndStop('save'));
            _.gotoAndStop(1);
        },
    },
    617: {
        press: _ => _.tell('../quit', t => t.gotoAndStop('quit')),
        release: gotoAndStop(1),
    },
    633: {
        press: _ => _.loadMovieNum('tip.swf', 99, 'GET'),
        release: gotoAndStop(1),
    },
    634: {
        release: _ => {
            _.tell('../helphelp', t => t.gotoAndStop(2));
            _.gotoAndStop(1);
        },
    },
    635: {
        release: _ => {
            _.loadMovieNum('help.swf', 17, 'GET');
            _.gotoAndStop(1);
        },
    },
    636: {
        press: _ => {
            _.tell('../about', t => t.gotoAndStop(2));
            _.gotoAndStop(1);
        },
    },
    /* quit */
    648: {
        release: _ => {
            _.getURL('javascript:close.window();', '_self');
            _.fscommand('quit');
        },
    },
    657: { release: gotoAndStop(3) },
    659: { release: _ => _.getURL('http://www.turtlereality.co.uk', '_blank') },
    665: { release: _ => _.tell('sysinfo', t => t.gotoAndStop(2)) },
    671: { release: gotoAndStop(4) },
    676: { press: _ => _.tell('egg', t => t.gotoAndStop(2)) },
    711: { release: _ => _.nextFrame() },
    718: {
        press: _ => {
            _.print(pageTextFrom(_, '../'));
            _.gotoAndStop(1);
        },
    },
    726: {
        press: _ => {
            _.tell('../', t => t.gotoAndStop('save'));
            _.gotoAndStop(1);
        },
    },
    768: { release: _ => _.tell('/helpbasic', t => t.gotoAndStop(2)) },
    769: { release: _ => _.tell('/gethelp', t => t.gotoAndStop(2)) },
    770: { release: _ => _.tell('/topic', t => t.gotoAndStop(2)) },
    774: { release: _ => _.tell('lf', t => t.gotoAndStop(2)) },
    780: { release: gotoAndStop(3) },
    781: { release: _ => _.tell('useful', t => t.gotoAndStop(2)) },
    786: { release: _ => _.tell('/topic', t => t.gotoAndStop(2)) },
    799: {
        press: gotoAndStop(1),
        release: _ => _.tell('../', t => t.gotoAndStop('sign')),
    },
    /* back to writing */
    802: { release: backToWriting },
    869: { release: backToWriting },
    813: { release: gotoAndStop(5) },
    814: { release: gotoAndStop(12) },
    815: { release: gotoAndStop(18) },
    816: { release: _ => _.tell('/brain', t => t.gotoAndStop('brain')) },
    817: { release: _ => _.tell('/yourbrain', t => t.gotoAndStop('brain')) },
    /* open: a row of the list puts its text on the paper */
    844: {
        release: _ => {
            _.set('fudge', pageText(_));
            _.set(pageText(_), _.get('/:m' + str(_.get('MyRowNo'))));
            _.set('/:Dname', _.get('MyRowIndex'));
            _.tell('/', t => t.gotoAndStop('continue'));
        },
    },
    862: {
        release: _ => _.tell('../', t => {
            t.gotoAndStop('continue');
            t.play();
        }),
    },
    866: { release: _ => _.set('/paper/p1/size1/:m', _.get('/paper/p1/size1/:m' + str(_.get('MyRowNo')))) },
    /* save */
    867: {
        release: _ => {
            _.set('m', _.get(`/paper/p${str(_.get('../:pap'))}/size${str(_.get('../:size'))}/:m`));
            _.set('name', _.get('../:name'));
            _.loadVariablesNum(`perhect${str(_.get('/:pap'))}.asp?action=sg`, 0, 'POST');
            _.tell('../', t => {
                t.gotoAndStop('saving');
                t.play();
            });
        },
    },
});
function menuOpen(_) {
    _.tell('../', t => t.gotoAndStop('nobuttons'));
    _.gotoAndStop(21);
}
function backToWriting(_) {
    _.tell(pageTextFrom(_, '../') + '/getkeys', t => t.gotoAndStop(1));
    /* nested in the original's tellTarget, and so from this timeline */
    _.tell('../', t => t.gotoAndStop('continue'));
}

/**
 * help.swf: loaded on level 17
 */
const help = { frames: {}, buttons: {} };
Object.assign(help.frames, {
    'root:1': gotoAndStop(5),
    'root:3': gotoAndPlay(1),
    'root:5': stop,
    '10:1': stop, '11:1': stop, '13:1': stop, '15:1': stop, '103:1': stop, '176:1': stop,
    /* the topic chosen from the menu */
    '176:2': _ => {
        _.tell('../helptext', t => t.gotoAndStop(_.get('/:q')));
        _.setProperty('../helptext', '_y', -40);
    },
});
/* the scroll arrows: clip, what they scroll, by */
[[10, 'helptext', -20], [11, 'helptext', 20], [13, 'menu', -20], [15, 'menu', 20]].forEach(([id, name, by]) => {
    help.frames[`${id}:2`] = _ => _.setProperty('../' + name, '_y', _.add(_.getProperty('../' + name, '_y'), by));
    help.frames[`${id}:3`] = _ => {
        _.setProperty('/' + name, '_y', _.add(_.getProperty('/' + name, '_y'), by));
        _.gotoAndPlay(2);
    };
});
Object.assign(help.buttons, {
    9: hold('loopa2'),
    12: hold('loopa'),
    14: hold('loop2'),
    16: hold('loop'),
    21: { release: _ => _.unloadMovieNum(17) },
    23: { press: _ => _.startDrag('', 0), release: _ => _.stopDrag() },
    28: { release: _ => _.unloadMovieNum(17) },
});
[9, 12, 14, 16].forEach(id => {
    help.buttons[id].releaseOutside = help.buttons[id].release;
    help.buttons[id].dragOut = help.buttons[id].release;
});
help.buttons[23].releaseOutside = help.buttons[23].release;
/* the menu of topics: button: topic (a frame of the help text) */
const TOPICS = {
    106: 71, 107: 70, 108: 69, 109: 68, 110: 2, 111: 67, 112: 66, 113: 65, 114: 64, 115: 63, 116: 62, 117: 61,
    118: 60, 119: 59, 120: 58, 121: 57, 122: 56, 123: 55, 124: 54, 125: 53, 126: 52, 127: 51, 128: 50, 129: 49,
    130: 48, 131: 47, 132: 46, 133: 45, 134: 44, 135: 43, 136: 42, 137: 23, 138: 24, 139: 41, 140: 40, 141: 39,
    142: 38, 143: 37, 144: 36, 145: 35, 146: 34, 147: 33, 148: 32, 149: 31, 150: 30, 151: 29, 152: 28, 153: 27,
    154: 26, 155: 25, 156: 22, 157: 21, 158: 20, 159: 19, 160: 18, 161: 17, 162: 16, 163: 15, 164: 14, 165: 13,
    166: 12, 167: 11, 168: 10, 169: 9, 170: 8, 171: 7, 172: 6, 173: 5, 174: 4, 175: 3,
};
Object.entries(TOPICS).forEach(([id, q]) => {
    help.buttons[id] = {
        release: _ => {
            _.set('/:q', String(q));
            _.call('2');
        },
    };
});

/**
 * tip.swf: the tip of the day, loaded on level 99
 */
const tip = { frames: {}, buttons: {} };
Object.assign(tip.frames, {
    'root:1': _ => {
        _.loadVariables('tips.asp?action=rd', '', 'POST');
        _.play();
    },
    'root:11': _ => {
        if (_.eq(_.get('loaded'), 1)) {
            _.gotoAndStop(14);
        } else {
            _.play();
        }
    },
    'root:13': gotoAndPlay(11),
    'root:14': gotoAndPlay(16),
    'root:15': gotoAndPlay(14),
    'root:16': _ => {
        _.stop();
        _.set('DiceRoll', _.random(45));
        _.set('tipnum', _.add(_.get('DiceRoll'), 1));
        _.set('tiptext', _.get('jname' + str(_.get('tipnum'))));
    },
    'root:22': stop,
});
Object.assign(tip.buttons, {
    2: { press: _ => _.startDrag('', 0), release: _ => _.stopDrag() },
    9: { release: _ => _.set('tiptext', "We haven't quite got around to doing this yet...") },
    /* next tip */
    10: {
        release: _ => {
            if (_.lt(_.get('tipnum'), 43)) {
                _.set('tipnum', _.add(_.get('tipnum'), 1));
                _.set('tiptext', _.get('jname' + str(_.get('tipnum'))));
            } else {
                _.set('/:tipnum', '2');
                _.set('/tip:tiptext', _.get('/:jname' + str(_.get('/:tipnum'))));
            }
        },
    },
    11: { release: gotoAndStop(22) },
    12: { press: gotoAndStop(22) },
});

const MOVIES = { perhect, help, tip };

export default {
    frame(movie, id, frame) {
        return MOVIES[movie.name].frames[`${id}:${frame}`];
    },
    button(movie, id) {
        return MOVIES[movie.name].buttons[id] || {};
    },
};
