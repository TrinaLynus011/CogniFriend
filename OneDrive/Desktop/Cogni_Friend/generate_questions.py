!pip install -q transformers accelerate

from transformers import pipeline
import re

def generate_quiz(topic):
    generator = pipeline(
        "text-generation",
        model="microsoft/phi-2",
        device_map="auto",
        torch_dtype="auto",
        max_new_tokens=500  # Increased for longer output
    )
    
    prompt = f"""Generate 5 distinct multiple choice questions about {topic} for kids. Use format:
    Question: [Question text]
    A) [Option A]
    B) [Option B]
    C) [Option C]
    D) [Option D]
    Answer: [Correct letter]
    
    Generate now:"""
    
    response = generator(prompt)[0]['generated_text']
    return response.split("Generate now:")[-1].strip()

def parse_questions(text):
    questions = []
    pattern = r'Question:\s*(.+?)\s+A\)\s*(.+?)\s+B\)\s*(.+?)\s+C\)\s*(.+?)\s+D\)\s*(.+?)\s+Answer:\s*([A-D])'
    
    for match in re.finditer(pattern, text, re.IGNORECASE | re.DOTALL):
        questions.append({
            "question": match.group(1).strip(),
            "options": {
                "A": match.group(2).strip(),
                "B": match.group(3).strip(),
                "C": match.group(4).strip(),
                "D": match.group(5).strip()
            },
            "answer": match.group(6).upper()
        })
    return questions[:5]  # Now returns up to 5 questions

def run_quiz(questions):
    if not questions:
        print("No questions generated. Try a simpler topic!")
        return
    
    print(f"📚 Quiz Time! ({len(questions)} Questions)")
    score = 0
    
    for i, q in enumerate(questions, 1):
        print(f"\nQ{i}: {q['question']}")
        for letter, text in q['options'].items():
            print(f"{letter}) {text}")
            
        while True:
            ans = input("Your answer (A-D): ").upper()
            if ans in ['A','B','C','D']:
                break
            print("Invalid input! Try again.")
            
        if ans == q['answer']:
            print("✅ Correct!")
            score += 1
        else:
            print(f"❌ Wrong! Answer: {q['answer']}")
    
    print(f"\nFinal Score: {score}/{len(questions)}")

# Execute
topic = input("Enter quiz topic: ").strip() or "photosynthesis"
raw_text = generate_quiz(topic)
questions = parse_questions(raw_text)
run_quiz(questions)
