<script setup lang="ts">
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonTextarea, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonCheckbox, IonAccordion, IonReorderGroup, IonReorder, modalController, alertController } from '@ionic/vue';
import { closeOutline, checkmarkOutline, addOutline, trashOutline, createOutline, reorderTwo } from 'ionicons/icons';
import type { ItemReorderEventDetail } from '@ionic/vue';
import { ref, onMounted } from 'vue';
import type { Quiz } from '@/models/quiz';
import type { Question } from '@/models/question';
import type { Choice } from '@/models/choice';

interface Props {
  quiz?: Quiz;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Nouveau Quiz'
});

const formData = ref({
  title: '',
  description: '',
  questions: [] as Question[]
});

onMounted(() => {
  if (props.quiz) {
    formData.value.title = props.quiz.title;
    formData.value.description = props.quiz.description || '';
    formData.value.questions = JSON.parse(JSON.stringify(props.quiz.questions || []));
  }
});

const handleClose = () => {
  modalController.dismiss(null, 'cancel');
};

const handleSubmit = () => {
  if (!isFormValid()) {
    return;
  }

  const quizData = {
    title: formData.value.title,
    description: formData.value.description,
    questions: formData.value.questions
  };

  modalController.dismiss(quizData, 'confirm');
};

const isFormValid = () => {
  // Vérifier que le titre n'est pas vide
  if (formData.value.title.trim() === '') {
    return false;
  }
  
  // Vérifier que toutes les réponses des questions ont un texte
  for (const question of formData.value.questions) {
    for (const choice of question.choices) {
      if (choice.text.trim() === '') {
        return false;
      }
    }
  }
  
  return true;
};

const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const addQuestion = async () => {
  const alert = await alertController.create({
    header: 'Nouvelle Question',
    inputs: [
      {
        name: 'questionText',
        type: 'textarea',
        placeholder: 'Entrez votre question...'
      }
    ],
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Ajouter',
        handler: (data) => {
          if (data.questionText && data.questionText.trim()) {
            const newQuestion: Question = {
              id: generateUniqueId(),
              text: data.questionText,
              choices: [
                { id: generateUniqueId(), text: '' },
                { id: generateUniqueId(), text: '' }
              ],
              correctAnswerIndex: 0
            };
            formData.value.questions.push(newQuestion);
            return true;
          }
          return false;
        }
      }
    ]
  });

  await alert.present();
};

const editQuestion = async (question: Question, index: number) => {
  const alert = await alertController.create({
    header: 'Modifier la Question',
    inputs: [
      {
        name: 'questionText',
        type: 'textarea',
        value: question.text,
        placeholder: 'Entrez votre question...'
      }
    ],
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Modifier',
        handler: (data) => {
          if (data.questionText && data.questionText.trim()) {
            formData.value.questions[index].text = data.questionText;
            return true;
          }
          return false;
        }
      }
    ]
  });

  await alert.present();
};

const deleteQuestion = async (index: number) => {
  const alert = await alertController.create({
    header: 'Confirmer',
    message: 'Voulez-vous vraiment supprimer cette question ?',
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Supprimer',
        role: 'destructive',
        handler: () => {
          formData.value.questions.splice(index, 1);
        }
      }
    ]
  });

  await alert.present();
};

const addChoice = (questionIndex: number) => {
  const newChoice: Choice = {
    id: generateUniqueId(),
    text: ''
  };
  formData.value.questions[questionIndex].choices.push(newChoice);
};

const updateChoiceText = (questionIndex: number, choiceIndex: number, event: any) => {
  formData.value.questions[questionIndex].choices[choiceIndex].text = event.target.value;
};

const deleteChoice = (questionIndex: number, choiceIndex: number) => {
  const question = formData.value.questions[questionIndex];
  if (question.choices.length > 2) {
    question.choices.splice(choiceIndex, 1);
    // Ajuster l'index de la bonne réponse si nécessaire
    if (question.correctAnswerIndex >= question.choices.length) {
      question.correctAnswerIndex = question.choices.length - 1;
    } else if (question.correctAnswerIndex > choiceIndex) {
      question.correctAnswerIndex--;
    }
  }
};

const setCorrectAnswer = (questionIndex: number, choiceIndex: number) => {
  // Toggle behavior: si déjà sélectionné, on garde (pas de désélection)
  formData.value.questions[questionIndex].correctAnswerIndex = choiceIndex;
};

const handleReorder = (event: CustomEvent<ItemReorderEventDetail>) => {
  // Réorganiser le tableau des questions
  const from = event.detail.from;
  const to = event.detail.to;
  
  const itemToMove = formData.value.questions[from];
  formData.value.questions.splice(from, 1);
  formData.value.questions.splice(to, 0, itemToMove);
  
  // Compléter le reorder
  event.detail.complete();
};
</script>

<template>
  <ion-header>
    <ion-toolbar>
      <ion-title>{{ title }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="handleClose">
          <ion-icon slot="icon-only" :icon="closeOutline"></ion-icon>
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div class="form-container">
      <!-- Informations de base du quiz -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Informations du Quiz</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label position="stacked">Titre <span style="color: red;">*</span></ion-label>
            <ion-input 
              v-model="formData.title" 
              placeholder="Entrez le titre du quiz" 
              required 
            />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Description</ion-label>
            <ion-textarea 
              v-model="formData.description" 
              placeholder="Entrez une description" 
              :rows="3" 
            />
          </ion-item>
        </ion-card-content>
      </ion-card>

      <!-- Questions -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            Questions ({{ formData.questions.length }})
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-button expand="block" @click="addQuestion" color="primary">
            <ion-icon slot="start" :icon="addOutline"></ion-icon>
            Ajouter une question
          </ion-button>

          <div v-if="formData.questions.length > 0" style="margin-top: 16px;">
            <!-- Questions avec drag & drop et leurs réponses -->
            <ion-reorder-group @ionItemReorder="handleReorder" :disabled="false">
              <div v-for="(question, qIndex) in formData.questions" :key="question.id" style="margin-bottom: 16px;">
                <!-- Header de la question avec drag pour réorganiser -->
                <ion-item class="question-header-item">
                  <ion-reorder slot="start">
                    <ion-icon :icon="reorderTwo"></ion-icon>
                  </ion-reorder>
                  <ion-label>
                    <h3>Question {{ qIndex + 1 }}</h3>
                    <p>{{ question.text }}</p>
                  </ion-label>
                </ion-item>
                
                <!-- Contenu de la question (non-draggable) -->
                <ion-card style="margin-top: 8px;">
                  <ion-card-content class="question-content">
                <!-- Actions sur la question -->
                <div class="question-actions">
                  <ion-button size="small" fill="clear" @click="editQuestion(question, qIndex)">
                    <ion-icon slot="start" :icon="createOutline"></ion-icon>
                    Modifier
                  </ion-button>
                  <ion-button size="small" fill="clear" color="danger" @click="deleteQuestion(qIndex)">
                    <ion-icon slot="start" :icon="trashOutline"></ion-icon>
                    Supprimer
                  </ion-button>
                </div>

                <!-- Réponses -->
                <ion-list>
                  <ion-list-header>
                    <ion-label>
                      Réponses 
                      <span style="font-size: 0.85em; opacity: 0.7;">
                        (Sélectionnez la bonne réponse)
                      </span>
                    </ion-label>
                  </ion-list-header>

                  <ion-item v-for="(choice, cIndex) in question.choices" :key="choice.id" class="choice-item">
                    <ion-checkbox
                      slot="start"
                      :checked="question.correctAnswerIndex === cIndex"
                      @ionChange="setCorrectAnswer(qIndex, cIndex)"
                    ></ion-checkbox>
                    <ion-input 
                      :value="choice.text"
                      @ionInput="updateChoiceText(qIndex, cIndex, $event)"
                      :placeholder="`Réponse ${cIndex + 1}`"
                      class="choice-input"
                    />
                    <ion-button 
                      slot="end" 
                      fill="clear" 
                      color="danger" 
                      size="small"
                      @click="deleteChoice(qIndex, cIndex)"
                      :disabled="question.choices.length <= 2"
                    >
                      <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
                    </ion-button>
                  </ion-item>

                  <ion-button 
                    expand="block" 
                    fill="outline" 
                    size="small" 
                    @click="addChoice(qIndex)"
                    style="margin-top: 8px;"
                  >
                    <ion-icon slot="start" :icon="addOutline"></ion-icon>
                    Ajouter une réponse
                  </ion-button>
                </ion-list>
                  </ion-card-content>
                </ion-card>
              </div>
            </ion-reorder-group>
          </div>

          <div v-else style="text-align: center; padding: 20px; opacity: 0.6;">
            Aucune question pour le moment
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Bouton de soumission -->
      <div class="submit-button">
        <ion-button 
          expand="block" 
          type="submit" 
          :disabled="!isFormValid()"
          @click="handleSubmit"
          size="large"
        >
          <ion-icon slot="start" :icon="checkmarkOutline"></ion-icon>
          {{ props.quiz ? 'Modifier' : 'Créer' }} le Quiz
        </ion-button>
      </div>
    </div>
  </ion-content>
</template>

<style scoped>
.form-container {
  padding: 16px;
  padding-bottom: 80px;
}

ion-item {
  margin-bottom: 8px;
}

ion-card {
  margin-bottom: 16px;
}

.question-content {
  padding: 16px;
  background: var(--ion-color-light);
}

.question-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ion-color-medium);
}

.choice-item {
  margin-bottom: 8px;
}

.choice-input {
  flex: 1;
  margin: 0 8px;
}

.submit-button {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: var(--ion-background-color);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

ion-accordion {
  margin-bottom: 8px;
  border-radius: 8px;
  overflow: hidden;
}

ion-list-header {
  font-weight: 600;
  margin-bottom: 8px;
}
</style>
