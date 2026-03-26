const http = require('http');

const roleSkillGroups = [
  ['Python', 'Django', 'REST APIs', 'PostgreSQL', 'Redis', 'Celery'],
  ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML', 'Vite'],
  ['Java', 'Spring Boot', 'Microservices', 'Docker', 'JUnit', 'Kafka'],
  ['AWS', 'Kubernetes', 'DevOps', 'CI/CD', 'Terraform', 'Linux'],
  ['Data analysis', 'Python', 'SQL', 'Pandas', 'NumPy', 'Statistics'],
  ['Node.js', 'Express', 'MongoDB', 'REST APIs', 'JWT', 'Socket.IO'],
  ['Machine Learning', 'TensorFlow', 'scikit-learn', 'Deep Learning', 'NLP', 'Feature Engineering'],
  ['Android', 'Kotlin', 'Jetpack', 'Room DB', 'MVVM', 'Play Console'],
  ['iOS', 'Swift', 'UIKit', 'CoreData', 'Xcode', 'TestFlight'],
  ['Cybersecurity', 'Network security', 'Penetration testing', 'SIEM', 'Encryption', 'OWASP'],
  ['QA', 'Selenium', 'Playwright', 'API testing', 'Manual testing', 'Test automation'],
  ['Cloud architecture', 'Azure', 'GCP', 'AWS', 'Serverless', 'Monitoring'],
];

const experienceLevels = [
  'intern-level projects',
  'entry-level implementation',
  '2 years hands-on experience',
  '3 years production experience',
  '5 years enterprise development',
  'lead-level design experience',
];

const softSkills = [
  'problem solving',
  'team collaboration',
  'agile delivery',
  'code reviews',
  'stakeholder communication',
  'mentoring',
];

function buildTestSkillSets(targetCount = 120) {
  const combinations = [];

  for (const group of roleSkillGroups) {
    for (const level of experienceLevels) {
      for (const softSkill of softSkills) {
        combinations.push(
          `${group[0]}, ${group[1]}, ${group[2]}, ${group[3]}, ${level}, strong ${softSkill}`
        );
      }
    }
  }

  return combinations.slice(0, targetCount);
}

const testSkillSets = buildTestSkillSets(120);

async function makeRequest(skills) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ skills });

    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/job/predict-job',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ skills, prediction: parsed.jobRole, error: parsed.error });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

async function runAllPredictions() {
  console.log(`\n🚀 Generating ${testSkillSets.length} predictions for MLflow...\n`);

  for (let i = 0; i < testSkillSets.length; i++) {
    const skills = testSkillSets[i];
    try {
      const result = await makeRequest(skills);
      console.log(
        `[${i + 1}/${testSkillSets.length}] ✅ "${skills}" → Predicted: ${result.prediction}`
      );
    } catch (error) {
      console.error(
        `[${i + 1}/${testSkillSets.length}] ❌ "${skills}" → Error: ${error.message}`
      );
    }

    // Small delay to avoid hammering the server
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('\n✅ All predictions completed! Check MLflow at http://localhost:5000\n');
}

runAllPredictions().catch(console.error);
