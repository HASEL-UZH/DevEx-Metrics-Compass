// ─── Shared company favicon helpers ───────────────────────────────────────────
// Used across step 1 (filter dropdown), step 2 (compare), and step 3 (next steps).

let companyDomainMap = null;

function getCompanyDomainMap() {
    if (companyDomainMap) return companyDomainMap;
    companyDomainMap = {};
    Object.values(SOURCE_URL_MAPPING).forEach(s => {
        if (!s.ref_name || s.company_size === 'N/A') return;
        const name = s.ref_name;
        if (companyDomainMap[name]) return; // first entry wins
        if (s.company_domain) {
            companyDomainMap[name] = s.company_domain;
        } else {
            companyDomainMap[name] = name.toLowerCase()
                .replace(/\s*\([^)]*\)/g, '') // "Amazon (AWS)" → "amazon"
                .replace(/\/.*/, '')           // "Twitter/X" → "twitter"
                .replace(/[^a-z0-9]/g, '')     // strip remaining special chars
                + '.com';
        }
    });
    return companyDomainMap;
}

// Returns the inner HTML for a favicon badge (company) or letter avatar (non-company).
function getEntityBadgeContent(type, value, size = 14) {
    const letter = value ? value[0].toUpperCase() : '?';
    if (type === 'company') {
        const domain = getCompanyDomainMap()[value];
        if (domain) {
            const src = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
            return `<img class="entity-favicon" src="${src}" alt="${letter}" width="${size}" height="${size}" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span class="entity-letter" style="display:none">${letter}</span>`;
        }
    }
    return `<span class="entity-letter">${letter}</span>`;
}

// Applies a favicon or colored letter badge as a CSS background-image on a <select> element.
// side: 'left' | 'right' | null — controls the badge color for non-company types.
function applyLogoBg(el, type, value, side = null) {
    if (value && value !== 'all') {
        const letter = value[0].toUpperCase();
        let bgSrc;
        if (type === 'company') {
            const domain = getCompanyDomainMap()[value];
            if (domain) {
                bgSrc = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
            } else {
                bgSrc = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14'%3E%3Crect width='14' height='14' rx='2' fill='%23e0e0e0'/%3E%3Ctext x='7' y='11' text-anchor='middle' font-size='10' font-weight='700' fill='%23666' font-family='sans-serif'%3E${letter}%3C/text%3E%3C/svg%3E`;
            }
        } else {
            const fill     = side === 'left' ? '%237c4daa' : side === 'right' ? '%231a7f5a' : '%23e0e0e0';
            const textFill = (side === 'left' || side === 'right') ? '%23fff' : '%23666';
            bgSrc = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14'%3E%3Crect width='14' height='14' rx='2' fill='${fill}'/%3E%3Ctext x='7' y='11' text-anchor='middle' font-size='10' font-weight='700' fill='${textFill}' font-family='sans-serif'%3E${letter}%3C/text%3E%3C/svg%3E`;
        }
        el.style.backgroundImage = `url("${bgSrc}")`;
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = '6px center';
        el.style.backgroundSize = '14px 14px';
        el.style.paddingLeft = '26px';
    } else {
        el.style.backgroundImage = '';
        el.style.backgroundRepeat = '';
        el.style.backgroundPosition = '';
        el.style.backgroundSize = '';
        el.style.paddingLeft = '';
    }
}
