import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../src/lib/rsi-org-scraper";

/**
 * HTML sanitizer tests — validates that scraped RSI HTML content
 * is stripped of dangerous tags and attributes before storage.
 * These tests cover the XSS attack vectors identified in the red team review.
 */
describe("sanitizeHtml", () => {
  describe("dangerous tag removal", () => {
    it("strips <script> tags and content", () => {
      const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      expect(sanitizeHtml(input)).toBe("<p>Hello</p><p>World</p>");
    });

    it("strips <style> tags and content", () => {
      const input = '<p>Hello</p><style>body { background: red; }</style><p>World</p>';
      expect(sanitizeHtml(input)).toBe("<p>Hello</p><p>World</p>");
    });

    it("strips <meta> tags (prevents http-equiv redirect)", () => {
      const input = '<meta http-equiv="refresh" content="0;url=https://evil.com"><p>Hello</p>';
      expect(sanitizeHtml(input)).toBe("<p>Hello</p>");
    });

    it("strips <iframe> tags", () => {
      const input = '<p>Before</p><iframe src="https://evil.com"></iframe><p>After</p>';
      expect(sanitizeHtml(input)).toBe("<p>Before</p><p>After</p>");
    });

    it("strips <form>, <input>, <button> tags", () => {
      const input = '<form action="/steal"><input type="password"><button>Submit</button></form>';
      expect(sanitizeHtml(input)).not.toContain("<form");
      expect(sanitizeHtml(input)).not.toContain("<input");
      expect(sanitizeHtml(input)).not.toContain("<button");
    });

    it("strips <object> and <embed> tags", () => {
      const input = '<object data="evil.swf"></object><embed src="evil.swf">';
      expect(sanitizeHtml(input)).not.toContain("<object");
      expect(sanitizeHtml(input)).not.toContain("<embed");
    });

    it("strips <svg> tags and content (prevents onload XSS)", () => {
      const input = '<svg onload="alert(1)"><circle r="10"/></svg>';
      expect(sanitizeHtml(input)).toBe("");
    });

    it("strips <link> tags (prevents external stylesheet injection)", () => {
      const input = '<link rel="stylesheet" href="https://evil.com/steal.css"><p>Content</p>';
      expect(sanitizeHtml(input)).toBe("<p>Content</p>");
    });

    it("strips <base> tags (prevents base URL hijack)", () => {
      const input = '<base href="https://evil.com/"><a href="/login">Login</a>';
      expect(sanitizeHtml(input)).toBe('<a href="/login">Login</a>');
    });
  });

  describe("event handler removal", () => {
    it("strips onerror attribute", () => {
      const input = '<img src="x" onerror="alert(1)">';
      expect(sanitizeHtml(input)).not.toContain("onerror");
    });

    it("strips onload attribute", () => {
      const input = '<img src="x" onload="alert(1)">';
      expect(sanitizeHtml(input)).not.toContain("onload");
    });

    it("strips onclick attribute", () => {
      const input = '<a onclick="alert(1)" href="#">Click</a>';
      expect(sanitizeHtml(input)).not.toContain("onclick");
      expect(sanitizeHtml(input)).toContain("href=");
    });

    it("strips onmouseover attribute", () => {
      const input = '<div onmouseover="alert(1)">Hover me</div>';
      expect(sanitizeHtml(input)).not.toContain("onmouseover");
      expect(sanitizeHtml(input)).toContain("Hover me");
    });
  });

  describe("style attribute removal", () => {
    it("strips inline style attributes (prevents CSS injection)", () => {
      const input = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:red;z-index:9999">Phishing overlay</div>';
      expect(sanitizeHtml(input)).not.toContain("style=");
      expect(sanitizeHtml(input)).toContain("Phishing overlay");
    });
  });

  describe("javascript: URL removal", () => {
    it("strips javascript: in href", () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      expect(sanitizeHtml(input)).not.toContain("javascript:");
    });

    it("strips data: in src", () => {
      const input = '<img src="data:text/html,<script>alert(1)</script>">';
      expect(sanitizeHtml(input)).not.toContain('src="data:');
    });
  });

  describe("safe content preservation", () => {
    it("preserves safe HTML elements", () => {
      const input = "<p>Hello <strong>world</strong>. <em>Italics</em> and <a href=\"https://example.com\">links</a>.</p>";
      expect(sanitizeHtml(input)).toBe(input);
    });

    it("preserves lists", () => {
      const input = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      expect(sanitizeHtml(input)).toBe(input);
    });

    it("preserves headings", () => {
      const input = "<h1>Title</h1><h2>Subtitle</h2><p>Content</p>";
      expect(sanitizeHtml(input)).toBe(input);
    });

    it("preserves blockquotes", () => {
      const input = "<blockquote>Important quote</blockquote>";
      expect(sanitizeHtml(input)).toBe(input);
    });

    it("preserves images with safe src", () => {
      const input = '<img src="https://example.com/image.png" alt="test">';
      expect(sanitizeHtml(input)).toBe(input);
    });

    it("handles empty input", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("handles null-like input", () => {
      expect(sanitizeHtml(null as unknown as string)).toBeNull();
    });
  });

  describe("case insensitivity", () => {
    it("strips SCRIPT tags (uppercase)", () => {
      const input = '<SCRIPT>alert(1)</SCRIPT>';
      expect(sanitizeHtml(input)).toBe("");
    });

    it("strips mixed-case style tags", () => {
      const input = '<Style>body{display:none}</Style>';
      expect(sanitizeHtml(input)).toBe("");
    });

    it("strips mixed-case event handlers", () => {
      const input = '<img OnError="alert(1)" src="x">';
      expect(sanitizeHtml(input)).not.toContain("OnError");
    });
  });
});
