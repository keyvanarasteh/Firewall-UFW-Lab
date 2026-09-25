/** Simulated /etc/ufw/applications.d/ profiles */
export interface AppProfile {
  name: string;
  title: string;
  description: string;
  /** e.g. "22/tcp" or "80,443/tcp" */
  ports: string;
}

export const APP_PROFILES: AppProfile[] = [
  { name: "Apache", title: "Web Server", description: "Apache v2 is the next generation of the omnipresent Apache web server.", ports: "80/tcp" },
  { name: "Apache Full", title: "Web Server (HTTP,HTTPS)", description: "Apache v2 is the next generation of the omnipresent Apache web server.", ports: "80,443/tcp" },
  { name: "Apache Secure", title: "Web Server (HTTPS)", description: "Apache v2 is the next generation of the omnipresent Apache web server.", ports: "443/tcp" },
  { name: "Nginx Full", title: "Web Server (Nginx, HTTP + HTTPS)", description: "Small, but very powerful and efficient web server", ports: "80,443/tcp" },
  { name: "Nginx HTTP", title: "Web Server (Nginx, HTTP)", description: "Small, but very powerful and efficient web server", ports: "80/tcp" },
  { name: "Nginx HTTPS", title: "Web Server (Nginx, HTTPS)", description: "Small, but very powerful and efficient web server", ports: "443/tcp" },
  { name: "OpenSSH", title: "Secure shell server, an rshd replacement", description: "OpenSSH is a free implementation of the Secure Shell protocol.", ports: "22/tcp" },
  { name: "Postfix", title: "Mail server", description: "Postfix is a high-performance mail transport agent.", ports: "25/tcp" },
  { name: "MySQL", title: "MySQL database server", description: "MySQL is an open source relational database server.", ports: "3306/tcp" },
];

export function findApp(name: string): AppProfile | undefined {
  return APP_PROFILES.find((a) => a.name.toLowerCase() === name.toLowerCase());
}
