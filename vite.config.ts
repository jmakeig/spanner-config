import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA mode: unknown URLs fall back to this shell and route on the client.
			adapter: adapter({ fallback: '200.html' })
		})
	],
	// Fail instead of silently moving to the next free port. The API key's
	// website restrictions only allow these exact ports.
	server: { port: 5173, strictPort: true },
	preview: { port: 4173, strictPort: true }
});
