export const XLINK = 'http://www.w3.org/1999/xlink';
export const XML = 'http://www.w3.org/XML/1998/namespace';
export const XMLNS = 'http://www.w3.org/2000/xmlns/';

// There is a small list of namespaced attributes specially
// enumerated in
// https://www.w3.org/TR/html/syntax.html#attributes-0
//
// > When a foreign element has one of the namespaced attributes given by
// > the local name and namespace of the first and second cells of a row
// > from the following table, it must be written using the name given by
// > the third cell from the same row.
//
// In all other cases, colons are interpreted as a regular character
// with no special meaning:
//
// > No other namespaced attribute can be expressed in the HTML syntax.

export const ADJUST_FOREIGN_ATTRIBUTES: Record<string, string> = {
  'xlink:actuate': XLINK,
  'xlink:arcrole': XLINK,
  'xlink:href': XLINK,
  'xlink:role': XLINK,
  'xlink:show': XLINK,
  'xlink:title': XLINK,
  'xlink:type': XLINK,
  'xml:base': XML,
  'xml:lang': XML,
  'xml:space': XML,
  xmlns: XMLNS,
  'xmlns:xlink': XMLNS,
};
