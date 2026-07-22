import { defineConfig } from "vitepress";

const DOCS_BASE = "/party/docs/";
const DOCS_URL = `https://caza.la${DOCS_BASE}`;
const REPOSITORY_URL = "https://github.com/cazala/party";

const guideRoutes: Record<string, string> = {
  "maintainer-guide.md": "maintainer-guide/",
  "module-author-guide.md": "module-author-guide/",
  "playground-maintainer-guide.md": "playground-maintainer-guide/",
  "playground-user-guide.md": "playground-user-guide/",
  "user-guide.md": "user-guide/",
};

const pageDescriptions: Record<string, string> = {
  "index.md":
    "Documentation for Party, a high-performance TypeScript particle system and physics engine with WebGPU compute and CPU fallback.",
  "maintainer-guide.md":
    "Architecture and maintenance guide for Party's CPU and WebGPU particle physics runtimes.",
  "module-author-guide.md":
    "Create custom CPU and WebGPU force and render modules for the Party particle physics engine.",
  "playground-maintainer-guide.md":
    "Architecture and maintenance guide for Party's React and Redux particle physics playground.",
  "playground-user-guide.md":
    "Use Party's interactive WebGPU particle physics playground, tools, sessions, oscillators, and hotkeys.",
  "user-guide.md":
    "Use the Party TypeScript particle physics engine with WebGPU compute, CPU fallback, modular forces, and render modules.",
};

const pageTitles: Record<string, string> = {
  "index.md": "Party — WebGPU particle system and physics engine",
  "maintainer-guide.md": "Party Engine Maintainer Guide",
  "module-author-guide.md": "Party Module Author Guide",
  "playground-maintainer-guide.md": "Party Playground Maintainer Guide",
  "playground-user-guide.md": "Party Playground User Guide",
  "user-guide.md": "Party Engine User Guide",
};

function guideHref(sourcePath: string): string | undefined {
  const sourceName = sourcePath
    .replace(/^\.\//, "")
    .replace(/^docs\//, "")
    .split("#", 1)[0];
  const route = guideRoutes[sourceName];
  return route ? `/${route}` : undefined;
}

function repositoryHref(repoPath: string): string {
  const cleanPath = repoPath.replace(/^\.\//, "").replace(/^\.\.\//, "");
  const isFile = cleanPath === "LICENSE" || /\.[^/]+$/.test(cleanPath);
  return `${REPOSITORY_URL}/${isFile ? "blob" : "tree"}/main/${cleanPath}`;
}

function rewriteHomepageHref(href: string): string {
  const cleanHref = href.replace(/^\.\//, "");

  if (cleanHref === "docs" || cleanHref === "docs/") {
    return "/";
  }

  const guide = guideHref(cleanHref);
  if (guide) return guide;

  if (cleanHref === "LICENSE" || cleanHref.startsWith("packages/")) {
    return repositoryHref(cleanHref);
  }

  return href;
}

function rewriteGuideHref(href: string): string {
  const guide = guideHref(href);
  if (guide) return guide;

  if (href.startsWith("../packages/")) {
    return repositoryHref(href);
  }

  return href;
}

function canonicalUrl(relativePath: string): string {
  const route = relativePath
    .replace(/index\.md$/, "")
    .replace(/\.md$/, "/");
  return new URL(route, DOCS_URL).toString();
}

export default defineConfig({
  lang: "en-US",
  title: "Party",
  titleTemplate: ":title | Party Documentation",
  description: pageDescriptions["index.md"],
  base: DOCS_BASE,
  outDir: "../packages/playground/dist/docs",
  lastUpdated: true,

  rewrites: Object.fromEntries(
    Object.entries(guideRoutes).map(([source, route]) => [
      source,
      `${route}index.md`,
    ]),
  ),

  sitemap: {
    hostname: DOCS_URL,
  },

  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/x-icon",
        href: "https://caza.la/party/favicon.ico",
      },
    ],
    ["meta", { name: "theme-color", content: "#0b0f19" }],
  ],

  markdown: {
    config(md) {
      md.core.ruler.after("inline", "party-homepage-title", (state) => {
        const sourcePage = String(
          state.env?.relativePath ?? state.env?.path ?? "",
        );
        if (sourcePage !== "index.md") return;

        const headingIndex = state.tokens.findIndex(
          (token) => token.type === "heading_open" && token.tag === "h1",
        );
        if (headingIndex === -1) return;

        const title = state.tokens[headingIndex + 1];
        if (
          title?.type !== "inline" ||
          title.content !==
            "Party 🎉 - [caza.la/party](https://caza.la/party)"
        ) {
          return;
        }

        const text = title.children?.find((token) => token.type === "text");
        if (!text) return;

        text.content = "Party 🎉";
        title.content = text.content;
        title.children = [text];
      });

      const defaultLinkOpen =
        md.renderer.rules.link_open ??
        ((tokens, index, options, _env, renderer) =>
          renderer.renderToken(tokens, index, options));

      md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
        const hrefIndex = tokens[index].attrIndex("href");
        if (hrefIndex >= 0) {
          const href = tokens[index].attrs![hrefIndex][1];
          const sourcePage = String(env?.relativePath ?? env?.path ?? "");
          tokens[index].attrs![hrefIndex][1] =
            sourcePage === "index.md"
              ? rewriteHomepageHref(href)
              : rewriteGuideHref(href);
        }

        return defaultLinkOpen(tokens, index, options, env, renderer);
      };
    },
  },

  transformPageData(pageData) {
    const title = pageTitles[pageData.filePath] ?? pageData.title;
    const description =
      pageDescriptions[pageData.filePath] ?? pageData.description;
    const frontmatter = { ...pageData.frontmatter };
    const head = [...(frontmatter.head ?? [])];

    if (pageData.isNotFound) {
      head.push(["meta", { name: "robots", content: "noindex" }]);
    } else {
      const canonical = canonicalUrl(pageData.relativePath);
      const socialTitle = `${title} | Party Documentation`;

      head.push(
        ["link", { rel: "canonical", href: canonical }],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:site_name", content: "Party" }],
        ["meta", { property: "og:title", content: socialTitle }],
        ["meta", { property: "og:description", content: description }],
        ["meta", { property: "og:url", content: canonical }],
        [
          "meta",
          {
            property: "og:image",
            content: "https://caza.la/party/logo.png",
          },
        ],
        ["meta", { name: "twitter:card", content: "summary" }],
        ["meta", { name: "twitter:title", content: socialTitle }],
        ["meta", { name: "twitter:description", content: description }],
        [
          "meta",
          {
            name: "twitter:image",
            content: "https://caza.la/party/logo.png",
          },
        ],
      );
    }

    frontmatter.head = head;
    return { title, description, frontmatter };
  },

  themeConfig: {
    nav: [
      { text: "Documentation", link: "/" },
      {
        text: "Playground",
        link: "https://caza.la/party/",
        target: "_self",
      },
      {
        text: "GitHub",
        link: REPOSITORY_URL,
        target: "_blank",
      },
    ],

    socialLinks: [{ icon: "github", link: REPOSITORY_URL }],

    sidebar: [
      { text: "Overview", link: "/" },
      {
        text: "Using Party",
        items: [
          { text: "Engine User Guide", link: "/user-guide/" },
          { text: "Writing Modules", link: "/module-author-guide/" },
          {
            text: "Playground User Guide",
            link: "/playground-user-guide/",
          },
        ],
      },
      {
        text: "Maintaining Party",
        items: [
          { text: "Engine Internals", link: "/maintainer-guide/" },
          {
            text: "Playground Internals",
            link: "/playground-maintainer-guide/",
          },
        ],
      },
    ],

    search: {
      provider: "local",
    },

    outline: {
      level: "deep",
      label: "On this page",
    },

    docFooter: {
      prev: "Previous guide",
      next: "Next guide",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Party contributors",
    },
  },
});
