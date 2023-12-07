import { injectGlobal } from '@mongodb-js/compass-components';

export function resetGlobalCSS() {
  injectGlobal(`
/* Remove list styles (bullets/numbers) */
ol,
ul {
  list-style: none;
}

/* Preferred box-sizing value */
*,
*::after,
*::before {
  box-sizing: border-box;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  font-smoothing: antialiased;
}

input,
button,
select,
textarea {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
button,
input,
optgroup,
select,
textarea {
  color: inherit;
  font: inherit;
  margin: 0;
}

html,
body,
fieldset,
ul,
ol,
dd,
dt {
  margin: 0;
  padding: 0;
  border: 0;
}

blockquote,
q {
  quotes: none;
}
blockquote:before,
blockquote:after,
q:before,
q:after {
  content: '';
  content: none;
}

/* Remove spacing between cells in tables */
table {
  border-collapse: collapse;
  border-spacing: 0;
}
`);
}
