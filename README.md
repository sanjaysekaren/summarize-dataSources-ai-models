This is a Medical AI advisor app - backend API using worker, built solely for cloudflare's AI hackthon. 

Client Repo for setup - https://github.com/sbbeez/cloudflare-hackathon.git

To run this project you must also run https://github.com/sanjaysekaren/summarize-dataSources-ai-models.git as it has all the code related to API.

Steps to set up the repo:
  1. Clone the repo
  2. Set your own Env variables in .dev.vars file:
      ACCESS_KEY_ID ,
      SECRET_ACCESS_KEY,
      ACCOUNT_ID ,
  3. Install the necessary packages by running **yarn install** or **yarn add <package-name>**
  4. Create a R2 bucket (it is also s3 compatible) in your cloudflare dashboard with name 'cf-hackathon-ai'
  5. Create a vectorized index with name "cf-hackathon"
  6. Run **cd summarize-dataSources-ai-models**.
  7. Install and login with wrangler to access our dashboard.
  8. Run **npx wrangler dev** to run the application.

You should be able to run the application in the displayed port.

Happy Coding !!
