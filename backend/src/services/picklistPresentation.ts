const NAME_ALIASES: Array<[RegExp, string]> = [
    [/usb\s+7-in-1\s+gissmo\s+xs1/i, 'USB 7-IN-2 GISSMO XS1'],
    [/stunt\s+car\s+selvim\s+rpkh(?!\s+jorh)/i, 'STUNT CAR SELVIM RPKH JORH 5MKX EGJF'],
    [/handsauger\s+schwarzz/i, 'HANDSAUGER SCHWARZ'],
    [/händsauger\s+schwarzz/i, 'HANDSAUGER SCHWARZ'],
    [/handsauger\s+alacris\s+uhh$/i, 'HANDSAUGER ALACRIS UHH/30R/NLP'],
    [/küche\s+wg194$/i, 'KÜCHE WG194 GRÜN'],
    [/nackenkissen\s+3wd$/i, 'NACKENKISSEN 3WD/U51/EI1'],
    [/elektrorasierer.*kopfrasierer|wasserdichter\s+rasierer.*7d\s+rasierapparat/i, 'Elektrorasierer Kopfrasierer'],
    [/lernspielzeug\s+krabbe|baby\s+spielzeug.*krabbe/i, 'KRABBE BLAU'],
    [/sofortbildkamera|kinderkamera.*zero\s+ink/i, 'DRUCKKAMERA PINK'],
    [/40000\s*mah.*powerbank/i, 'POWERBANK 40000MAH'],
    [/led\s+deckenleuchte\s+jj12131-a-05/i, 'LED DECKENLEUCHTE JJ12131-A-05'],
    [/staratlas\s+f3f/i, 'STARATLAS F3F'],
    [/insektent[oö]ter/i, 'INSEKTENTÖTER'],
    [/luftgebläse\s+3g9/i, 'LUFTGEBLÄSE 3G9']
];

export function normalizePicklistDisplayName(value?: string | null) {
    const cleaned = String(value || '').replace(/\.\d+$/, '').trim();
    if (!cleaned) return '';

    for (const [pattern, alias] of NAME_ALIASES) {
        if (pattern.test(cleaned)) return alias;
    }

    return cleaned;
}
