/**
 * Test file demonstrating IAMTokenUtils usage
 * Run with: bun run src/utils/iam-token-utils.test.ts
 */

import { 
  IAMTokenUtils, 
  TokenException, 
  createIAMTokenUtils,
  getIAMToken,
  getIAMTokenWithConfig,
  type IAMConfig 
} from './iam-token-utils';
import { getIAMConfig, logIAMConfig } from '../config/iam.config';

/**
 * Test the IAM token utility
 */
async function testIAMTokenUtils() {
  console.log('🧪 Testing IAM Token Utils...\n');

  try {
    // Test 0: Show current configuration
    console.log('0️⃣ Current IAM Configuration:');
    logIAMConfig();

    // Test 1: Using deployment configuration
    console.log('\n1️⃣ Testing with deployment configuration:');
    const deploymentUtils = createIAMTokenUtils();
    
    try {
      const config = getIAMConfig();
      const token1 = await deploymentUtils.getNewToken(config.tenantName);
      console.log('✅ Token generated successfully:', token1.substring(0, 27) + '...');
      console.log('   Bearer format:', token1.startsWith('Bearer '));
    } catch (error) {
      console.log('❌ Token generation failed:', error instanceof Error ? error.message : error);
    }

    console.log('\n2️⃣ Testing with utility function (auto-config):');
    try {
      const token2 = await getIAMToken(); // Uses config default tenant
      console.log('✅ Token generated successfully:', token2.substring(0, 27) + '...');
      console.log('   Ready for Authorization header:', token2.startsWith('Bearer '));
    } catch (error) {
      console.log('❌ Token generation failed:', error instanceof Error ? error.message : error);
    }

    console.log('\n3️⃣ Testing with custom configuration:');
    const customConfig: IAMConfig = {
      url: 'https://integrationtest.jiffy.ai/',
      grantType: 'client_credentials',
      scope: 'openid email profile',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      tenantName: 'test-tenant'
    };

    try {
      const token3 = await getIAMTokenWithConfig(customConfig, 'test-tenant');
      console.log('✅ Token generated successfully:', token3.substring(0, 27) + '...');
    } catch (error) {
      if (error instanceof TokenException) {
        console.log(`❌ TokenException [${error.errorCode}]:`, error.message);
      } else {
        console.log('❌ Unknown error:', error);
      }
    }

    console.log('\n4️⃣ Testing with specific tenant override:');
    try {
      const token4 = await getIAMToken('custom-tenant-name');
      console.log('✅ Token generated:', token4.substring(0, 27) + '...');
    } catch (error) {
      if (error instanceof TokenException) {
        console.log(`❌ Expected TokenException [${error.errorCode}]:`, error.message);
      } else {
        console.log('❌ Unexpected error:', error);
      }
    }

  } catch (error) {
    console.error('💥 Test execution failed:', error);
  }

  console.log('\n🏁 IAM Token Utils testing completed!');
}

// Run tests if this file is executed directly
if (import.meta.main) {
  testIAMTokenUtils().catch(console.error);
}

export { testIAMTokenUtils };