module.exports = {
  Email: {
    testing: true,
    transport: {
      smtp: {
        host: "host",
        port: "port",
        secure: true,
        auth: {
          user: "username",
          pass: "pass"
        },
        // Security options to disallow using attachments from file or URL
        disableFileAccess: true,
        disableUrlAccess: true,
        // create a smtp connection pool
        pool: true
      }
    },
    defaults: {},
    htmlToText: {},
    queue: {
      retryLimit: 10,
      retryBackoff: true,
      retryDelay: 1,
      expireIn:   "60 min"
    },
    mailgen: {
      theme: "default",
      product: {
        // Appears in header & footer of e-mails
        name: "Mailgen",
        link: "https://mailgen.js/"
        // Optional logo
        // logo: "https://mailgen.js/img/logo.png"
      }
    }
  }
};
