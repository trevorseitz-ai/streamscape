import os
import sys
import glob
from openai import OpenAI

def run_sentinel():
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    # 1. Ingest the Marketing Bible source of truth
    with open("docs/depts/marketing.md", "r") as f:
        marketing_bible = f.read()
        
    # 2. Collect all pending content items from staging
    staging_files = glob.glob("content/staging/*.txt") + glob.glob("content/staging/*.md")
    
    if not staging_files:
        print("No new content found to validate.")
        sys.exit(0)
        
    violations = 0
    
    for file_path in staging_files:
        with open(file_path, "r") as f:
            pending_content = f.read()
            
        # 3. Construct the prompt enforcing Section 1 rules
        prompt = f"""
        You are The Sentinel, the brand safety gatekeeper for ReelDive.
        Your job is to audit newly generated marketing copy against our Core Protocol.
        
        CRITICAL RULE: ReelDive does NOT contain a customer-facing chatbot or conversational support widget.
        
        Marketing Bible Reference:
        \"\"\"
        {marketing_bible}
        \"\"\"
        
        Evaluate this pending content:
        \"\"\"
        {pending_content}
        \"\"\"
        
        Does this copy mention, imply, or reference a customer-facing chatbot, interactive text bubble, or live conversational assistant?
        Respond with exactly 'FAIL' followed by a brief reason if it violates the rule. Otherwise, respond with exactly 'PASS'.
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0
        )
        
        result = response.choices[0].message.content.strip()
        
        if "FAIL" in result:
            print(f"❌ Guardrail Violation in {file_path}:")
            print(result)
            violations += 1
        else:
            print(f"✅ {file_path} passed semantic validation.")
            
    if violations > 0:
        print(f"\nValidation failed with {violations} protocol violations.")
        sys.exit(1) # Fails the GitHub Action pipeline

if __name__ == "__main__":
    run_sentinel()
