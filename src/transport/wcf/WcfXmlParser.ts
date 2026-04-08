/**
 * Browser-native XML parser for WCF XML-RPC responses.
 * Replaces the legacy dojox/xml/parser + $.xml2json pattern.
 */
export class WcfXmlParser {
  private static readonly _parser = new DOMParser();

  /**
   * Parse an XML string into a DOM Document.
   * Throws if the XML is malformed.
   */
  static parse(xmlString: string): Document {
    const doc = WcfXmlParser._parser.parseFromString(xmlString, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`XML parse error: ${parseError.textContent}`);
    }
    return doc;
  }

  /**
   * Find the first element matching a tag name (local name, ignoring namespace).
   */
  static findFirst(doc: Document | Element, tagName: string): Element | null {
    // Try namespace-agnostic search
    const elements = doc.getElementsByTagName(tagName);
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Find all elements matching a tag name.
   */
  static findAll(doc: Document | Element, tagName: string): Element[] {
    return Array.from(doc.getElementsByTagName(tagName));
  }

  /**
   * Convert an XML element and its children to a plain JS object.
   * Leaf text nodes become string values. Repeated child tags become arrays.
   */
  static toObject(element: Element): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Collect attributes
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      result[`@${attr.name}`] = attr.value;
    }

    // Collect child elements
    const childElements = Array.from(element.children);
    if (childElements.length === 0) {
      // Leaf node — return text content as a simple object
      const text = element.textContent?.trim() ?? '';
      if (text && Object.keys(result).length === 0) {
        // Pure text node — caller should extract via textContent
        result['#text'] = text;
      } else if (text) {
        result['#text'] = text;
      }
      return result;
    }

    // Group children by tag name
    const groups = new Map<string, Element[]>();
    for (const child of childElements) {
      const tag = child.localName;
      const existing = groups.get(tag);
      if (existing) {
        existing.push(child);
      } else {
        groups.set(tag, [child]);
      }
    }

    for (const [tag, elements] of groups) {
      if (elements.length === 1) {
        const child = elements[0];
        if (child.children.length === 0 && child.attributes.length === 0) {
          // Simple text child
          result[tag] = child.textContent?.trim() ?? '';
        } else {
          result[tag] = WcfXmlParser.toObject(child);
        }
      } else {
        // Multiple children with same tag → array
        result[tag] = elements.map((el) =>
          el.children.length === 0 && el.attributes.length === 0
            ? (el.textContent?.trim() ?? '')
            : WcfXmlParser.toObject(el),
        );
      }
    }

    return result;
  }

  /**
   * Get the text content of the first matching element.
   */
  static getText(parent: Document | Element, tagName: string): string | null {
    const el = WcfXmlParser.findFirst(parent, tagName);
    return el?.textContent?.trim() ?? null;
  }
}
