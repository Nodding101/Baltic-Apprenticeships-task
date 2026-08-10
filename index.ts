// index.ts
import * as fs from "fs";
import * as path from "path";
import { processWithLLM, Category } from "./llm";

interface Enquiry {
  enquiry_id: string;
  customer_name: string;
  email: string;
  message: string;
  date_received: string;
}

interface ProcessedEnquiry extends Enquiry {
  category: Category;
  summary: string;
}

const outputPath = path.join(__dirname, "process.json");

// Handles form processing
export async function addNewEnquiry(
  customerName: string,
  email: string,
  message: string,
): Promise<void> {
  let processedData: ProcessedEnquiry[] = [];

  // Load existing database
  if (fs.existsSync(outputPath)) {
    processedData = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  }

  // Generate a mock ID and get today's date
  const enquiryId =
    "REQ" +
    Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
  const dateReceived = new Date().toISOString().split("T")[0];

  console.log(`\nProcessing new enquiry (${enquiryId}) via LLM...`);
  const llmResult = await processWithLLM(message);

  // Create the new record
  const newEnquiry: ProcessedEnquiry = {
    enquiry_id: enquiryId,
    customer_name: customerName,
    email,
    message,
    date_received: dateReceived,
    category: llmResult.category,
    summary: llmResult.summary,
  };

  // Add to top of array and save
  processedData.unshift(newEnquiry);
  fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2));
  console.log(`Saved new enquiry to process.json!`);
}

export async function buildDashboardHTML(): Promise<string> {
  const inputPath = path.join(__dirname, "sample_enquiries.json");
  const categories: Category[] = [
    "Sales",
    "Support",
    "Complaint",
    "Manual Review",
  ];

  let processedData: ProcessedEnquiry[] = [];

  // Load or generate data
  if (fs.existsSync(outputPath)) {
    processedData = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  } else {
    console.log("Processing initial data via LLM (this will take a moment)...");
    const rawData = fs.readFileSync(inputPath, "utf-8");
    const enquiries: Enquiry[] = JSON.parse(rawData);

    processedData = [];

    const BATCH_SIZE = 20;

    for (let i = 0; i < enquiries.length; i += BATCH_SIZE) {
      // 1. Slice the array into a chunk of 20 (or whatever is left)
      const batch = enquiries.slice(i, i + BATCH_SIZE);
      console.log(
        `\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)...`,
      );

      // 2. Process this specific batch concurrently
      const batchResults = await Promise.all(
        batch.map(async (enquiry) => {
          const result = await processWithLLM(enquiry.message);
          return { ...enquiry, ...result };
        }),
      );

      // 3. Add the finished batch to our main array
      processedData.push(...batchResults);

      // 4. If there are still more items to process, wait 60 seconds for the rate limit to reset
      if (i + BATCH_SIZE < enquiries.length) {
        console.log(
          "Rate limit reached. Waiting 60 seconds for OpenRouter to reset...",
        );
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }

    console.log("Batch processing finished");
    fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2));
  }

  // Sort by date (most recent first)
  processedData.sort(
    (a, b) =>
      new Date(b.date_received).getTime() - new Date(a.date_received).getTime(),
  );

  const displayTabs = ["All", ...categories];

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Enquiry Dashboard</title>
        <style>
            body { font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #333; }
            h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
            
            .nav-buttons { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
            button.tab-btn { 
                padding: 10px 20px; cursor: pointer; border: 1px solid #ccc; 
                background: #f5f5f5; border-radius: 4px; font-weight: bold; transition: background 0.2s;
            }
            button.tab-btn:hover { background: #e0e0e0; }
            button.tab-btn.active { background: #333; color: white; border-color: #333; }
            .btn-submit { background: #1976d2 !important; color: white !important; border-color: #1565c0 !important; }
            
            .tab-content { display: none; }
            .active-tab { display: block; }
            
            .enquiry-card { 
                border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; 
                border-radius: 8px; background: #fafafa; box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
            }
            .enquiry-card:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.1); }
            
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-bottom: 10px; }
            .sales { background: #e3f2fd; color: #1565c0; }
            .support { background: #e8f5e9; color: #2e7d32; }
            .complaint { background: #ffebee; color: #c62828; }
            .manual { background: #fff3e0; color: #ef6c00; }
            
            /* Form Styles */
            .form-group { margin-bottom: 15px; }
            .form-group label { display: block; font-weight: bold; margin-bottom: 5px; }
            .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
            .submit-btn { background: #333; color: white; border: none; padding: 12px 20px; font-size: 16px; border-radius: 4px; cursor: pointer; }
            .submit-btn:hover { background: #555; }
            
            /* Modal Styles */
            .modal-overlay { 
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.6); align-items: center; justify-content: center; z-index: 1000;
            }
            .modal-overlay.active { display: flex; }
            .modal-content { 
                background: #fff; padding: 30px; border-radius: 8px; width: 90%; max-width: 600px; 
                position: relative; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            }
            .close-btn { 
                position: absolute; top: 15px; right: 15px; cursor: pointer; border: none; 
                background: #eee; padding: 8px 12px; border-radius: 4px; font-weight: bold;
            }
        </style>
    </head>
    <body>
        <h1>Enquiry Routing Dashboard</h1>
        
        <!-- Navigation Buttons -->
        <div class="nav-buttons">
            ${displayTabs
      .map(
        (tab) => `
                <button id="btn-${tab.replace(" ", "_")}" class="tab-btn" onclick="showTab('${tab.replace(" ", "_")}')">${tab}</button>
            `,
      )
      .join("")}
            <!-- New Form Tab Button -->
            <button id="btn-Submit_New" class="tab-btn btn-submit" onclick="showTab('Submit_New')">+ Submit New</button>
        </div>

        <!-- Team Views (Tabs) -->
        ${displayTabs
      .map((tab) => {
        const teamEnquiries =
          tab === "All"
            ? processedData
            : processedData.filter((e) => e.category === tab);
        const tabId = tab.replace(" ", "_");

        return `
            <div id="${tabId}" class="tab-content">
                <h2>${tab === "All" ? "All Enquiries" : tab + " Queue"} (${teamEnquiries.length})</h2>
                ${teamEnquiries.length === 0 ? "<p>No enquiries assigned to this team currently.</p>" : ""}
                
                ${teamEnquiries
            .map((e) => {
              const badgeClass = e.category.split(" ")[0].toLowerCase();
              return `
                    <div class="enquiry-card" onclick="openModal('${e.enquiry_id}')">
                        <span class="badge ${badgeClass}">${e.category}</span>
                        <span style="float: right; color: #666; font-size: 14px;">${e.date_received}</span><br>
                        <strong>ID:</strong> ${e.enquiry_id} | <strong>From:</strong> ${e.customer_name}<br><br>
                        <strong>Summary:</strong> ${e.summary}
                    </div>`;
            })
            .join("")}
            </div>`;
      })
      .join("")}

        <!-- New Submission Form -->
        <div id="Submit_New" class="tab-content">
            <h2>Submit a New Enquiry</h2>
            <p>Test the LLM categorization by submitting a new mock message here.</p>
            <form method="POST" action="/submit" style="max-width: 600px; background: #fafafa; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <div class="form-group">
                    <label>Customer Name:</label>
                    <input type="text" name="customer_name" required placeholder="e.g. Jane Doe">
                </div>
                <div class="form-group">
                    <label>Email Address:</label>
                    <input type="email" name="email" required placeholder="jane@example.com">
                </div>
                <div class="form-group">
                    <label>Enquiry Message:</label>
                    <textarea name="message" required rows="5" placeholder="Type your message here..."></textarea>
                </div>
                <button type="submit" class="submit-btn">Process & Save Enquiry</button>
            </form>
        </div>

        <!-- Modal Popup -->
        <div id="modal-overlay" class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <button class="close-btn" onclick="closeModal()">Close (X)</button>
                <div id="modal-body"></div>
            </div>
        </div>

        <!-- Scripts -->
        <script>
            const allEnquiries = ${JSON.stringify(processedData)};

            function showTab(tabId) {
                document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                
                const selectedTab = document.getElementById(tabId);
                const selectedBtn = document.getElementById('btn-' + tabId);
                if (selectedTab) selectedTab.classList.add('active-tab');
                if (selectedBtn) selectedBtn.classList.add('active');
            }
            
            function openModal(enquiryId) {
                const data = allEnquiries.find(e => e.enquiry_id === enquiryId);
                if (!data) return;
                const badgeClass = data.category.split(' ')[0].toLowerCase();
                
                document.getElementById('modal-body').innerHTML = \`
                    <span class="badge \${badgeClass}">\${data.category}</span>
                    <h2 style="margin-top: 5px;">\${data.enquiry_id}</h2>
                    <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                        <strong>Customer:</strong> \${data.customer_name}<br>
                        <strong>Email:</strong> \${data.email}<br>
                        <strong>Date:</strong> \${data.date_received}
                    </div>
                    <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                        <strong>AI Generated Summary:</strong><br>
                        <p style="background: #f5f5f5; padding: 10px; border-left: 3px solid #ccc;">\${data.summary}</p>
                    </div>
                    <div>
                        <strong>Original Message:</strong><br>
                        <p style="white-space: pre-wrap;">\${data.message}</p>
                    </div>\`;
                document.getElementById('modal-overlay').classList.add('active');
                document.body.style.overflow = 'hidden';
            }

            function closeModal() {
                document.getElementById('modal-overlay').classList.remove('active');
                document.body.style.overflow = 'auto';
            }
            
            showTab('All');
        </script>
    </body>
    </html>`;
}
