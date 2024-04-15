This Repo contains Code for AI Cloudflare Hackathon challenge 

Steps to set up the repo:
  1. Clone the repo
  2. Set your own Env variables in .dev.vars file:
    - ACCESS_KEY_ID = 
    - SECRET_ACCESS_KEY = 
    - ACCOUNT_ID = 
    - GEMINI_API_KEY = 
  3. Install the necessary packages by running yarn install or yarn add <package-name>
  4. Create a R2 bucket in your cloudflare dashboard with name 'cf-hackathon-ai'
  5. Install and login with wrangler to access our dashboard.
  6. Run **npx wrangler dev** to run the application.

You should be able to run the application in the displayed port.

Happy Coding !!
