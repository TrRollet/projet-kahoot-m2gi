<script setup lang="ts">
import { IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonInput, IonTextarea, IonIcon, IonCheckbox, IonReorderGroup, IonReorder, IonSelect, IonSelectOption, modalController, alertController } from '@ionic/vue';
import { closeOutline, checkmarkOutline, addOutline, trashOutline, createOutline, reorderTwo, chevronDownOutline, chevronUpOutline, imageOutline, closeCircleOutline } from 'ionicons/icons';
import type { ItemReorderEventDetail } from '@ionic/vue';
import { ref, onMounted } from 'vue';
import type { Quiz } from '@/models/quiz';
import type { Question } from '@/models/question';
import type { Choice } from '@/models/choice';
import { compressImage } from '@/utils/image';

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

const expandedQuestions = ref<Set<string>>(new Set())

function toggleExpand(questionId: string) {
  if (expandedQuestions.value.has(questionId)) {
    expandedQuestions.value.delete(questionId)
  } else {
    expandedQuestions.value.add(questionId)
  }
}

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
  if (formData.value.title.trim() === '') {
    return false;
  }
  // Un choix est valide s'il a du texte OU une image (ou si number => correctNumber)
  for (const question of formData.value.questions) {
    if (question.type === 'number') {
      if (typeof question.correctNumber !== 'number') return false;
    } else {
      for (const choice of question.choices) {
        if (choice.text.trim() === '' && !choice.imageBase64) {
          return false;
        }
      }
      if (question.type === 'multiple' && (!question.correctAnswers || question.correctAnswers.length === 0)) {
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
              type: 'single',
              text: data.questionText,
              choices: [
                { id: generateUniqueId(), text: '' },
                { id: generateUniqueId(), text: '' }
              ],
              correctAnswerIndex: 0,
              correctAnswers: [],
              correctNumber: 0
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
  if (formData.value.questions[questionIndex].choices.length >= 4) return;
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
    if (question.correctAnswerIndex >= question.choices.length) {
      question.correctAnswerIndex = question.choices.length - 1;
    } else if (question.correctAnswerIndex > choiceIndex) {
      question.correctAnswerIndex--;
    }
  }
};

const setCorrectAnswer = (questionIndex: number, choiceIndex: number) => {
  formData.value.questions[questionIndex].correctAnswerIndex = choiceIndex;
};

const toggleMultipleAnswer = (questionIndex: number, choiceIndex: number, checked: boolean) => {
  const q = formData.value.questions[questionIndex];
  if (!q.correctAnswers) q.correctAnswers = [];
  if (checked) {
    if (!q.correctAnswers.includes(choiceIndex)) q.correctAnswers.push(choiceIndex);
  } else {
    q.correctAnswers = q.correctAnswers.filter(i => i !== choiceIndex);
  }
};

const handleReorder = (event: CustomEvent<ItemReorderEventDetail>) => {
  const from = event.detail.from;
  const to = event.detail.to;

  const questions = [...formData.value.questions];
  const [item] = questions.splice(from, 1);
  questions.splice(to, 0, item);
  formData.value.questions = questions;

  event.detail.complete();
};

// -- Image picker --------------------------------------------------------------

const fileInputRef = ref<HTMLInputElement | null>(null)

type ImageTarget =
  | { type: 'question'; questionIndex: number }
  | { type: 'choice'; questionIndex: number; choiceIndex: number }

const imageTarget = ref<ImageTarget | null>(null)

function pickImage(target: ImageTarget) {
  imageTarget.value = target
  fileInputRef.value?.click()
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !imageTarget.value) return

  const base64 = await compressImage(file)
  const target = imageTarget.value

  if (target.type === 'question') {
    formData.value.questions[target.questionIndex].imageBase64 = base64
  } else {
    formData.value.questions[target.questionIndex].choices[target.choiceIndex].imageBase64 = base64
  }

  // Reset pour permettre de re-sélectionner le même fichier
  input.value = ''
}

function removeQuestionImage(questionIndex: number) {
  delete formData.value.questions[questionIndex].imageBase64
}

function removeChoiceImage(questionIndex: number, choiceIndex: number) {
  delete formData.value.questions[questionIndex].choices[choiceIndex].imageBase64
}
</script>

<template>
  <ion-header>
    <ion-toolbar>
      <div class="toolbar-title">{{ title }}</div>
      <ion-buttons slot="end">
        <ion-button @click="handleClose">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <!-- Input fichier caché, partagé pour toutes les images -->
  <input
    ref="fileInputRef"
    type="file"
    accept="image/*"
    class="hidden-file-input"
    @change="handleFileSelected"
  />

  <ion-content>
    <div class="form-container">
      <!-- Quiz info -->
      <div class="form-section">
        <p class="form-label">Titre *</p>
        <ion-input v-model="formData.title" placeholder="Titre du quiz" fill="outline" class="form-input" />
        <p class="form-label">Description</p>
        <ion-textarea v-model="formData.description" placeholder="Description (optionnel)" :rows="3" fill="outline" class="form-input" />
      </div>

      <!-- Questions -->
      <div class="form-section">
        <div class="section-header">
          <p class="form-label" style="margin:0">Questions ({{ formData.questions.length }})</p>
          <ion-button fill="solid" size="small" color="secondary" @click="addQuestion">
            <ion-icon slot="start" :icon="addOutline" />
            Ajouter
          </ion-button>
        </div>

        <div v-if="formData.questions.length > 0">
          <ion-reorder-group @ionItemReorder="handleReorder" :disabled="false">
            <div v-for="(question, qIndex) in formData.questions" :key="question.id" class="question-block">
              <div class="question-header">
                <ion-reorder class="reorder-handle">
                  <ion-icon :icon="reorderTwo" />
                </ion-reorder>
                <div class="question-header-text" @click="toggleExpand(question.id)">
                  <span class="q-num">Q{{ qIndex + 1 }}</span>
                  <span class="q-label">{{ question.text }}</span>
                  <ion-icon :icon="expandedQuestions.has(question.id) ? chevronUpOutline : chevronDownOutline" class="expand-icon" />
                </div>
                <ion-button fill="clear" size="small" @click="editQuestion(question, qIndex)">
                  <ion-icon slot="icon-only" :icon="createOutline" />
                </ion-button>
                <ion-button fill="clear" size="small" color="danger" @click="deleteQuestion(qIndex)">
                  <ion-icon slot="icon-only" :icon="trashOutline" />
                </ion-button>
              </div>

              <div v-if="expandedQuestions.has(question.id)" class="choices-list">
                <!-- Image de la question -->
                <p class="choices-hint">Image de la question (optionnelle)</p>
                <div class="img-picker-row">
                  <div v-if="question.imageBase64" class="img-preview-wrap">
                    <img :src="question.imageBase64" class="img-preview" />
                    <button class="img-remove-btn" @click="removeQuestionImage(qIndex)">
                      <ion-icon :icon="closeCircleOutline" />
                    </button>
                  </div>
                  <ion-button
                    v-else
                    fill="outline"
                    size="small"
                    @click="pickImage({ type: 'question', questionIndex: qIndex })"
                    class="img-add-btn"
                  >
                    <ion-icon slot="start" :icon="imageOutline" />
                    Ajouter une image
                  </ion-button>
                </div>

                <!-- Type de question -->
                <p class="choices-hint" style="margin-top: 12px">Type de question</p>
                <ion-select v-model="question.type" interface="popover" fill="outline" class="form-input">
                  <ion-select-option value="single">Choix unique</ion-select-option>
                  <ion-select-option value="multiple">Choix multiples</ion-select-option>
                  <ion-select-option value="number">Nombre exact (le plus proche)</ion-select-option>
                </ion-select>

                <!-- Si type Nombre -->
                <template v-if="question.type === 'number'">
                  <p class="choices-hint" style="margin-top: 12px">Bonne réponse (nombre)</p>
                  <ion-input type="number" v-model.number="question.correctNumber" placeholder="Ex: 42" fill="outline" class="form-input" />
                </template>

                <!-- Si type Choix (Single ou Multiple) -->
                <template v-else>
                  <p class="choices-hint" style="margin-top: 12px">Réponses (cochez la/les bonne(s))</p>
                <div v-for="(choice, cIndex) in question.choices" :key="choice.id" class="choice-block">
                  <div class="choice-row">
                    <!-- Pour 'single' -->
                    <ion-checkbox
                      v-if="!question.type || question.type === 'single'"
                      :checked="question.correctAnswerIndex === cIndex"
                      @ionChange="setCorrectAnswer(qIndex, cIndex)"
                    />
                    <!-- Pour 'multiple' -->
                    <ion-checkbox
                      v-else-if="question.type === 'multiple'"
                      :checked="question.correctAnswers?.includes(cIndex)"
                      @ionChange="toggleMultipleAnswer(qIndex, cIndex, $event.detail.checked)"
                    />
                    <ion-input
                      :value="choice.text"
                      @ionInput="updateChoiceText(qIndex, cIndex, $event)"
                      :placeholder="choice.imageBase64 ? 'Texte (optionnel)' : `Reponse ${cIndex + 1}`"
                      fill="outline"
                      class="choice-input"
                    />
                    <ion-button
                      fill="clear"
                      size="small"
                      @click="pickImage({ type: 'choice', questionIndex: qIndex, choiceIndex: cIndex })"
                    >
                      <ion-icon slot="icon-only" :icon="imageOutline" />
                    </ion-button>
                    <ion-button
                      fill="clear"
                      color="danger"
                      size="small"
                      @click="deleteChoice(qIndex, cIndex)"
                      :disabled="question.choices.length <= 2"
                    >
                      <ion-icon slot="icon-only" :icon="trashOutline" />
                    </ion-button>
                  </div>
                  <!-- Apercu image du choix -->
                  <div v-if="choice.imageBase64" class="choice-img-wrap">
                    <img :src="choice.imageBase64" class="choice-img-preview" />
                    <button class="img-remove-btn" @click="removeChoiceImage(qIndex, cIndex)">
                      <ion-icon :icon="closeCircleOutline" />
                    </button>
                  </div>
                </div>

                <ion-button expand="block" fill="outline" size="small" @click="addChoice(qIndex)" class="add-choice-btn" :disabled="question.choices.length >= 4">
                  <ion-icon slot="start" :icon="addOutline" />
                  Ajouter une reponse{{ question.choices.length >= 4 ? ' (max 4)' : '' }}
                </ion-button>
                </template>
              </div>
            </div>
          </ion-reorder-group>
        </div>

        <div v-else class="empty-state">Aucune question pour le moment</div>
      </div>

      <!-- Submit -->
      <div class="submit-area">
        <ion-button
          expand="block"
          color="primary"
          size="large"
          :disabled="!isFormValid()"
          class="submit-btn"
          @click="handleSubmit"
        >
          <ion-icon slot="start" :icon="checkmarkOutline" />
          {{ props.quiz ? 'Modifier' : 'Creer' }} le Quiz
        </ion-button>
      </div>
    </div>
  </ion-content>
</template>

<style scoped>
.hidden-file-input { display: none; }

.toolbar-title { font-weight: 600; font-size: 1.05rem; padding-left: 16px; }
.form-container { padding: 16px; padding-bottom: 100px; max-width: 600px; margin: 0 auto; }

.form-section {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
}
.form-label {
  font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--app-text-secondary); font-weight: 600; margin: 0 0 6px;
}
.form-input { --border-radius: 10px; margin-bottom: 12px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }

.question-block {
  background: var(--app-surface-alt);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
}
.question-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 8px 10px 4px;
  border-bottom: 1px solid var(--app-border);
}
.reorder-handle { display: flex; align-items: center; padding: 0 4px; color: var(--app-text-secondary); cursor: grab; }
.question-header-text { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; cursor: pointer; }
.q-num {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  background: var(--ion-color-primary); color: white;
  border-radius: 6px; padding: 2px 6px; flex-shrink: 0;
}
.q-label { font-weight: 500; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.expand-icon { margin-left: auto; font-size: 1rem; color: var(--app-text-secondary); flex-shrink: 0; }

.choices-list { padding: 12px; }
.choices-hint { font-size: 0.75rem; color: var(--app-text-secondary); margin: 0 0 8px; }

/* Image de la question */
.img-picker-row { margin-bottom: 4px; }
.img-preview-wrap { position: relative; display: inline-block; }
.img-preview {
  display: block; max-height: 140px; max-width: 100%;
  border-radius: 10px; object-fit: cover;
  border: 1px solid var(--app-border);
}
.img-add-btn { --border-radius: 8px; }

/* Image d'un choix */
.choice-block { margin-bottom: 8px; }
.choice-row { display: flex; align-items: center; gap: 8px; }
.choice-input { --border-radius: 8px; flex: 1; }
.choice-img-wrap { position: relative; display: inline-block; margin-top: 4px; margin-left: 32px; }
.choice-img-preview {
  display: block; max-height: 80px; max-width: 180px;
  border-radius: 8px; object-fit: cover;
  border: 1px solid var(--app-border);
}

/* Bouton supprimer image */
.img-remove-btn {
  position: absolute; top: -8px; right: -8px;
  background: var(--ion-background-color); border: none; padding: 0;
  border-radius: 50%; cursor: pointer; line-height: 0;
  color: var(--ion-color-danger); font-size: 1.2rem;
}

.add-choice-btn { --border-radius: 8px; margin-top: 4px; }
.empty-state { text-align: center; padding: 24px; color: var(--app-text-secondary); font-size: 0.92rem; }

.submit-area {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 12px 16px; padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: var(--ion-background-color);
  border-top: 1px solid var(--app-border);
  z-index: 10;
}
.submit-btn { --border-radius: 14px; font-weight: 700; }
</style>
