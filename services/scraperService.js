/**
 * Scraper Service
 * Handles safe fetching and cleaning of content for Knowledge Ingestion.
 */
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

class ScraperService {

    constructor() {
        this.TIMEOUT_MS = 5000;
        this.MAX_SIZE_BYTES = 50 * 1024; // 50KB limit for text
        this.MAX_IMG_BYTES = 200 * 1024; // 200KB limit for images
    }

    /**
     * Fetch Branding (Favicon/Logo)
     * @param {string} rawUrl - Website URL
     * @param {string} connectionId - For folder storage
     */
    async fetchBranding(rawUrl, connectionId) {
        if (!rawUrl || !connectionId) throw new Error("URL and ConnectionID required");

        const targetDir = path.join(__dirname, '..', 'public', 'branding', connectionId);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const report = {
            faviconPath: null,
            logoPath: null,
            status: 'FAILED'
        };

        try {
            const urlObj = new URL(rawUrl);
            const baseUrl = urlObj.origin;

            // 1. Fetch HTML to find tags
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

            let html = "";
            try {
                const res = await fetch(rawUrl, { signal: controller.signal });
                if (res.ok) html = await res.text();
            } catch (e) {
                console.warn("HTML fetch failed, trying default favicon only");
            } finally {
                clearTimeout(timeout);
            }

            // 2. Favicon Strategy
            // A. Try /favicon.ico
            let faviconUrl = `${baseUrl}/favicon.ico`;
            if (await this._downloadImage(faviconUrl, path.join(targetDir, 'favicon.ico'))) {
                report.faviconPath = `/branding/${connectionId}/favicon.ico`;
            }
            // B. Try <link rel="icon">
            else {
                const linkIconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
                if (linkIconMatch && linkIconMatch[1]) {
                    const absIconUrl = new URL(linkIconMatch[1], baseUrl).href;
                    if (await this._downloadImage(absIconUrl, path.join(targetDir, 'favicon.ico'))) {
                        report.faviconPath = `/branding/${connectionId}/favicon.ico`;
                    }
                }
            }

            // 3. Logo Strategy
            // A. Try <meta property="og:image">
            const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
            if (ogImageMatch && ogImageMatch[1]) {
                const absLogoUrl = new URL(ogImageMatch[1], baseUrl).href;
                if (await this._downloadImage(absLogoUrl, path.join(targetDir, 'logo.png'))) {
                    report.logoPath = `/branding/${connectionId}/logo.png`;
                }
            }

            // B. Try 'logo' keyword in img tags (Simple Regex fallback)
            if (!report.logoPath) {
                const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
                for (const match of imgMatches) {
                    if (match[0].toLowerCase().includes('logo') || match[1].toLowerCase().includes('logo')) {
                        const absLogoUrl = new URL(match[1], baseUrl).href;
                        if (await this._downloadImage(absLogoUrl, path.join(targetDir, 'logo.png'))) {
                            report.logoPath = `/branding/${connectionId}/logo.png`;
                            break;
                        }
                    }
                }
            }

            // Determine Status
            if (report.faviconPath && report.logoPath) report.status = 'READY';
            else if (report.faviconPath || report.logoPath) report.status = 'PARTIAL';
            else report.status = 'FAILED';

        } catch (err) {
            console.error("Branding Fetch Error:", err);
            report.status = 'FAILED';
        }

        return report;
    }

    async _downloadImage(url, destPath) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) return false;

            const type = res.headers.get("content-type") || "";
            if (!type.startsWith("image/")) return false;

            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length > this.MAX_IMG_BYTES) return false;

            fs.writeFileSync(destPath, buffer);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Scrape Website (Identity Scan)
     * Fetches homepage and extracts metadata/content for bot identity suggestions.
     */
    async scrapeWebsite(url) {
        try {
            const response = await fetch(url, {
                headers: { "User-Agent": "ChatbotIdentityBot/1.0" }
            });

            if (!response.ok) throw new Error("Failed to fetch website");

            const html = await response.text();

            // Extract Title
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : "";

            // Extract Meta Description
            const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
            const description = descMatch ? descMatch[1].trim() : "";

            // Extract Clean Body Text (for AI inference)
            const cleanText = this._cleanHTML(html);

            return {
                success: true,
                metadata: {
                    title,
                    description
                },
                rawText: cleanText // Returning clean text as "rawText" for route compatibility
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Ingest URL: Fetch, validate, and extract clean text.
     * @param {string} url 
     * @returns {Promise<{rawText: string, cleanedText: string}>}
     */
    async ingestURL(url) {
        // 1. Validate Protocol
        if (!url.startsWith("http")) {
            throw new Error("Invalid protocol. Only HTTP/HTTPS allowed.");
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

        try {
            // 2. Fetch with Timeout
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "ChatbotKnowledgeBot/1.0"
                }
            });

            // 3. Validate Content Type
            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("text/html")) {
                throw new Error(`Invalid content-type: ${contentType}. Only text/html allowed.`);
            }

            // 4. Size Check (Stream reading or buffer check)
            // For simplicity in Node 18+, we can grab text but check length
            const html = await response.text();

            if (html.length > this.MAX_SIZE_BYTES) {
                throw new Error(`Content too large (${html.length} bytes). Limit is ${this.MAX_SIZE_BYTES}.`);
            }

            // 5. Clean / Extract Text
            const cleaned = this._cleanHTML(html);

            return {
                rawText: html, // Optional storage? Plan says optional but model has it. Storing for audit.
                cleanedText: cleaned
            };

        } catch (error) {
            if (error.name === 'AbortError') throw new Error("Request timed out (5s limit).");
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Ingest Text: Normalize manual input.
     * @param {string} text 
     * @returns {{rawText: string, cleanedText: string}}
     */
    ingestText(text) {
        if (!text || text.length === 0) throw new Error("Empty text provided.");

        const cleaned = text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        return {
            rawText: text,
            cleanedText: cleaned
        };
    }

    /**
     * Simple HTML Stripper (Regex-based for Phase 9)
     * Removes <script>, <style>, tags, and excess whitespace.
     */
    _cleanHTML(html) {
        let text = html || "";

        // Remove Head (CSS/Scripts usually here)
        text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

        // Remove Scripts & Styles
        text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
        text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

        // Remove HTML Tags
        text = text.replace(/<[^>]+>/g, ' ');

        // Decode Entities (Basic ones)
        text = text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');

        // Normalize Whitespace
        text = text.replace(/\s+/g, ' ').trim();

        return text;
    }
}

module.exports = new ScraperService();
