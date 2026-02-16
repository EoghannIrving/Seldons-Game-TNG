# Deployment Guide

This document provides instructions for building the Seldon's Game TNG application and deploying it to a static hosting provider.

## Building the Application

The project is built using Vite, a modern and fast build tool for web projects. The build process compiles the TypeScript code, bundles all assets, and outputs a production-ready static web application to the `dist` directory.

**Prerequisites:**

*   Node.js and npm installed.

**Build Steps:**

1.  **Install Dependencies:**
    
    ```bash
    npm install
    ```
    
2.  **Run the Build:**
    
    ```bash
    npm run build
    ```
    
    This command will create a `dist` directory in the `seldon-game` folder. This directory contains all the static files for the application and is ready to be deployed.

3.  **Preview the Build Locally (Optional):**
    
    You can preview the production build locally by running:
    
    ```bash
    npm run preview
    ```
    
    This will start a local web server and provide a URL to view the application.

## Deployment Options

Below are instructions for deploying the application to several popular static hosting platforms.

### GitHub Pages

GitHub Pages is a great option for hosting your application directly from your GitHub repository.

1.  **Push to GitHub:** Ensure your code is pushed to a GitHub repository.
2.  **Configure GitHub Pages:**
    *   Go to your repository's **Settings** tab.
    *   In the **Code and automation** section of the sidebar, click **Pages**.
    *   Under **Build and deployment**, under **Source**, select **GitHub Actions**.
3.  **Configure Vite:**
    *   In `vite.config.ts`, set the `base` option to the name of your repository (e.g., `base: '/<YOUR-REPO-NAME>/'`).
4.  **Commit and Push:** Commit and push the change to `vite.config.ts`.

GitHub Actions will automatically build and deploy your application. The site will be available at `https://<YOUR-USERNAME>.github.io/<YOUR-REPO-NAME>/`.

### Netlify

Netlify offers a seamless deployment experience with a generous free tier.

1.  **Push to a Git Provider:** Push your code to a GitHub, GitLab, or Bitbucket repository.
2.  **Create a Netlify Account:** Sign up for a free account at [netlify.com](https://netlify.com).
3.  **Create a New Site:**
    *   From your Netlify dashboard, click **Add new site** > **Import an existing project**.
    *   Connect to your Git provider and select your repository.
4.  **Configure Build Settings:**
    *   **Build command:** `npm run build`
    *   **Publish directory:** `seldon-game/dist`
5.  **Deploy:** Click **Deploy site**. Netlify will build and deploy your application.

### Vercel

Vercel provides a fast and reliable hosting solution with a great developer experience.

1.  **Push to a Git Provider:** Push your code to a GitHub, GitLab, or Bitbucket repository.
2.  **Create a Vercel Account:** Sign up for a free account at [vercel.com](https://vercel.com).
3.  **Import Project:**
    *   From your Vercel dashboard, click **Add New...** > **Project**.
    *   Connect to your Git provider and select your repository.
4.  **Configure Project:**
    *   Vercel will automatically detect that you are using Vite.
    *   Set the **Root Directory** to `seldon-game`.
    *   The **Build and Output Settings** should be automatically configured.
5.  **Deploy:** Click **Deploy**. Vercel will build and deploy your application.

## Comparison of Deployment Options

| Feature         | GitHub Pages                                                                                                                                                                                          | Netlify                                                                                                                                                                                                                                                        | Vercel                                                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pros**        | **- Cost-Effective for Open Source:** Completely free for public repositories with no traffic limits.<br>**- Simplicity and Integration:** Minimal setup required. Deployment is automated on every push via GitHub Actions.<br>**- Directly Tied to Source:** The website is hosted directly from the repository, simplifying version control. | **- Rich Feature Set on Free Tier:** Includes atomic deploys, continuous deployment, free SSL, custom domains, and serverless functions.<br>**- Superior Developer Experience (DX):** Features deploy previews for every PR, instant rollbacks, and an intuitive dashboard.<br>**- Extensibility:** Integrated features like form handling, A/B testing, and authentication. | **- Peak Performance:** Global edge network (CDN), automatic image optimization, and intelligent caching for fast load times.<br>**- Seamless Framework Integration:** Zero-configuration support for Vite, Next.js, and more.<br>**- Collaborative Workflow:** Automatic, shareable deploy previews with commenting features. |
| **Cons**        | **- Private Repository Cost:** Requires a paid GitHub Pro or Team plan for private repositories.<br>**- Limited Server-Side Capabilities:** Only serves static files; no support for serverless functions or backend logic.<br>**- No Deploy Previews:** Does not automatically generate preview URLs for pull requests. | **- Pricing at Scale:** Costs can increase significantly for high-traffic sites or teams needing more build minutes or serverless function executions.<br>**- Potential for Complexity:** The vast number of features can be overwhelming for simple projects.                                                                                             | **- Pricing Model:** Can become costly if your project exceeds the limits of the free "Hobby" plan.<br>**- Focus on Jamstack/Next.js:** Its identity and most advanced features are tightly coupled with the Jamstack architecture and its own Next.js framework.                                                                   |
| **Cost (Free)** | Free for public repositories.                                                                                                                                                                         | **Generous free tier:** Includes 100GB of bandwidth per month, 300 build minutes per month, and serverless function invocations.                                                                                                                                  | **Generous hobby tier:** Includes 100GB of bandwidth per month, significant build capacity, and serverless function invocations.                                                                                                                                  |
| **Cost (Paid)** | Starts with GitHub Pro ($4/month) or Team ($21/user/month) for private repositories.                                                                                                                    | **Pro Plan:** Starts at $19 per user/month, offering more build minutes, higher bandwidth, and additional features.<br>**Business Plan:** Custom pricing for enterprise-level needs.                                                                               | **Pro Plan:** Starts at $20 per user/month, offering more bandwidth, team collaboration features, and faster builds.<br>**Enterprise Plan:** Custom pricing for advanced security and support needs.                                                              |

### Summary

*   **GitHub Pages:** Best for simple, open-source projects already on GitHub.
*   **Netlify:** A great all-around choice with a fantastic developer experience and a rich feature set on its free tier.
*   **Vercel:** Ideal if you are focused on raw performance and want a platform that is heavily optimized for modern frontend frameworks.

## Platform Recommendations for Seldon's Game TNG

Given the specific nature of this project as a complex, client-side simulation, here is a more detailed analysis of how each platform fits the current codebase and the future roadmap.

### Key Project Considerations

*   **Client-Side Heavy:** The application's core is a sophisticated simulation that runs in the user's browser. Performance and fast delivery of the initial JavaScript bundles are critical.
*   **Static First, Potentially More Later:** The current project is 100% static. However, the `ROADMAP.md` mentions a "Multiviewer" (Phase 14), which may require a simple backend or real-time service in the future.
*   **Global Audience:** As a web-based application, it should be fast for users anywhere in the world. This makes a Content Delivery Network (CDN) a high-priority feature.

### Analysis

#### GitHub Pages

*   **Pros for this Project:** It is the simplest and most cost-effective solution for the *current* state of the project. Since the codebase is entirely static, GitHub Pages can serve it effectively with no configuration overhead.
*   **Cons for this Project:** It will likely be outgrown. The lack of an integrated serverless function environment means that implementing the "Multiviewer" feature would require a completely separate service (e.g., a standalone server on another platform). Furthermore, while GitHub Pages uses a CDN, it offers less control and potentially lower performance than the specialized edge networks of Netlify and Vercel.

#### Netlify

*   **Pros for this Project:** This is a very strong contender. Netlify's powerful free tier, global CDN, and excellent developer experience are ideal. Crucially, **Netlify Functions** (serverless functions) provide a perfect, low-cost path for implementing the future "Multiviewer" feature without needing to manage a separate backend. You can build and deploy a simple real-time backend using WebSockets or a lightweight API directly within your Netlify project. The automatic deploy previews are also invaluable for testing complex simulation changes before they go live.
*   **Cons for this Project:** There are very few cons for this specific project. The main consideration would be cost if the application becomes extremely popular and exceeds the generous free tier limits for bandwidth or function invocations.

#### Vercel

*   **Pros for this Project:** Vercel is also an excellent choice, sharing many of the same benefits as Netlify. Its primary advantage is a relentless focus on performance, with a world-class edge network that ensures the initial JavaScript payload is delivered as quickly as possible. This is highly relevant for a complex simulation. Like Netlify, **Vercel Functions** provide a clear path for future backend needs like the "Multiviewer". Its collaborative tools for commenting on deploy previews could also be beneficial for a project with such a detailed and public roadmap.
*   **Cons for this Project:** Similar to Netlify, the main drawback is the potential for cost at very high scale. Its deep integration with Next.js is not a direct benefit here, but it doesn't detract from its excellent support for Vite projects.

### Final Recommendation

For the Seldon's Game TNG project, both **Netlify and Vercel are superior long-term choices** over GitHub Pages.

*   Choose **GitHub Pages** only if your priority is the absolute simplest, no-cost solution for the immediate future and you are willing to migrate to another platform when you begin implementing Phase 14.
*   Choose **Netlify or Vercel** if you want a platform that will support the project's entire roadmap, from its current static form to its future state with a lightweight backend. They provide the performance, features, and scalability needed for a complex, simulation-based web application.

The choice between Netlify and Vercel often comes down to personal preference in their UI and developer workflow. Both are top-tier platforms that would serve this project exceptionally well.

