// server.js
const { createServer } = require('node:http');
const { buildDashboardHTML, addNewEnquiry } = require('./index.ts');

const hostname = '127.0.0.1';
const port = 3000;

const server = createServer(async (req, res) => {
    
    // Handle standard GET requests (Loading the Dashboard)
    if (req.method === 'GET' && req.url === '/') {
        try {
            const htmlString = await buildDashboardHTML();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(htmlString);
        } catch (error) {
            console.error(error);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    } 
    
    // Handle POST requests (Form Submission)
    else if (req.method === 'POST' && req.url === '/submit') {
        let body = '';
        
        // Listen for data packets and stitch them together
        req.on('data', chunk => {
            body += chunk.toString(); 
        });
        
        // When all data is received, process it
        req.on('end', async () => {
            try {
                // Parse the URL-encoded form data
                const params = new URLSearchParams(body);
                const name = params.get('customer_name');
                const email = params.get('email');
                const message = params.get('message');
                
                // If the form was filled out, send it to the LLM
                if (name && email && message) {
                    await addNewEnquiry(name, email, message);
                }
                
                // Redirect the browser back to the homepage to see the new result
                res.statusCode = 302;
                res.setHeader('Location', '/');
                res.end();
            } catch (error) {
                console.error("Error saving new enquiry:", error);
                res.statusCode = 500;
                res.end('Failed to process enquiry.');
            }
        });
    } 
    
    // Handle 404s
    else {
        res.statusCode = 404;
        res.end('404 - Not found');
    }
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
    console.log(`Press Ctrl+C to stop.`);
});
