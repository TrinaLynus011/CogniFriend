# --- Imports ---
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from transformers import BertTokenizer, BertModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
import os

# --- Data Preprocessing for AI Tutoring Dataset ---
def load_and_preprocess_data():
    df = pd.read_excel("Processed_AI_Tutoring.xlsx")
    df = df.drop(columns=["Student_ID"], errors='ignore')

    label_encoders = {}
    categorical_cols = ["Learning_Preference", "Disability_Type"]
    for col in categorical_cols:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col])
        label_encoders[col] = le

    scaler = MinMaxScaler()
    numerical_cols = ["Age", "Grade", "Time_Spent", "Attempts", "Hints_Used", "Final_Score"]
    df[numerical_cols] = scaler.fit_transform(df[numerical_cols])
    df["Final_Score"] /= 100

    features = df.drop(columns=["Final_Score", "Learning_Preference", "Disability_Type"])
    targets = df[["Final_Score", "Learning_Preference", "Disability_Type"]]
    return train_test_split(features, targets, test_size=0.2, random_state=42)

# --- BERT-LSTM Model for AI Tutoring ---
tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')

class EducationalContentModel(nn.Module):
    def __init__(self, bert_dim=768, hidden_size=128):
        super().__init__()
        self.bert = BertModel.from_pretrained('bert-base-uncased')
        self.lstm = nn.LSTM(bert_dim, hidden_size, batch_first=True)
        self.fc_score = nn.Linear(hidden_size, 1)
        self.fc_preference = nn.Linear(hidden_size, 3)
        self.fc_disability = nn.Linear(hidden_size, 3)

    def forward(self, input_text):
        encoding = tokenizer(input_text, return_tensors='pt', padding=True, truncation=True)
        bert_output = self.bert(**encoding).last_hidden_state
        lstm_out, _ = self.lstm(bert_output)
        last_hidden = lstm_out[:, -1, :]
        score = torch.sigmoid(self.fc_score(last_hidden))
        preference = torch.softmax(self.fc_preference(last_hidden), dim=1)
        disability = torch.softmax(self.fc_disability(last_hidden), dim=1)
        return score, preference, disability

# --- Training Pipeline ---
def train_model(X_train, y_train, epochs=5):  # reduce epochs for testing
    model = EducationalContentModel()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    regression_loss = nn.MSELoss()
    classification_loss = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        # Placeholder: simulate input_text with same batch length
        input_text = ["This student needs help understanding math."] * len(X_train)
        scores, prefs, disabilities = model(input_text)
        loss_score = regression_loss(scores.squeeze(), torch.tensor(y_train.iloc[:, 0].values, dtype=torch.float))
        loss_pref = classification_loss(prefs, torch.tensor(y_train.iloc[:, 1].values, dtype=torch.long))
        loss_disability = classification_loss(disabilities, torch.tensor(y_train.iloc[:, 2].values, dtype=torch.long))
        total_loss = loss_score + loss_pref + loss_disability
        total_loss.backward()
        optimizer.step()
        print(f"Epoch {epoch+1}: Loss {total_loss.item():.4f}")

    return model

# --- Save Model ---
def save_model(model):
    torch.save(model.state_dict(), "education_model.pth")
    print("Model saved as education_model.pth")

# --- Coursera Data Preprocessing ---
def preprocess_coursera(df):
    df = df.rename(columns={
        'course_rating': 'Rating',
        'course_difficulty': 'Difficulty',
        'course_students_enrolled': 'Enrollment'
    })

    def convert_enrollment(val):
        if isinstance(val, str):
            val = val.lower()
            if 'k' in val:
                return float(val.replace('k', '')) * 1000
            elif 'm' in val:
                return float(val.replace('m', '')) * 1000000
        return float(val)

    df['Enrollment'] = df['Enrollment'].apply(convert_enrollment)
    df['Rating'] = df['Rating'].fillna(df['Rating'].median())
    difficulty_map = {'Beginner': 0, 'Intermediate': 1, 'Advanced': 2, 'Mixed': 1}
    df['Difficulty'] = df['Difficulty'].map(difficulty_map)
    df['Popularity'] = pd.cut(df['Enrollment'], bins=[0, 10000, 50000, float('inf')],
                              labels=['Low', 'Medium', 'High'])
    df['course_Certificate_type'] = df['course_Certificate_type'].str.title()
    return df

# --- Recommendation System ---
def build_recommender(df):
    tfidf = TfidfVectorizer(stop_words='english')
    tfidf_matrix = tfidf.fit_transform(df['course_title'].fillna(''))
    cosine_sim = linear_kernel(tfidf_matrix, tfidf_matrix)
    df = df.reset_index()

    def recommend_courses(title):
        indices = df[df['course_title'] == title].index
        if len(indices) == 0:
            return f"No course found with title '{title}'"
        idx = indices[0]
        sim_scores = list(enumerate(cosine_sim[idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        top_indices = [i[0] for i in sim_scores[1:6]]
        return df['course_title'].iloc[top_indices]

    return recommend_courses

# --- Main Execution ---
if __name__ == "__main__":
    # AI Tutoring Section
    if os.path.exists("Processed_AI_Tutoring.xlsx"):
        X_train, X_test, y_train, y_test = load_and_preprocess_data()
        trained_model = train_model(X_train, y_train)
        save_model(trained_model)
    else:
        print("Missing file: Processed_AI_Tutoring.xlsx")

    # Coursera Dataset Section
    if os.path.exists("coursea_data.csv"):
        coursera_df = pd.read_csv("coursea_data.csv")
        processed_coursera = preprocess_coursera(coursera_df)

        print("\nTop 5 Courses:")
        print(processed_coursera[['course_title', 'Rating', 'Difficulty', 'Enrollment']].head())

        # Course Insights
        difficulty_dist = processed_coursera['Difficulty'].value_counts()
        top_universities = processed_coursera['course_organization'].value_counts().head(10)
        rating_enrollment_corr = processed_coursera[['Rating', 'Enrollment']].corr()

        print("\nDifficulty Distribution:\n", difficulty_dist)
        print("\nTop Universities:\n", top_universities)
        print("\nRating vs Enrollment Correlation:\n", rating_enrollment_corr)

        # Recommendation
        recommender = build_recommender(processed_coursera)
        print("\nRecommended courses for 'Machine Learning':")
        print(recommender("Machine Learning"))
    else:
        print("Missing file: coursea_data.csv")
